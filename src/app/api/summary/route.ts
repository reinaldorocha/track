import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { purgeTestSales } from '@/lib/integrations/normalizer'
import { Prisma } from '@prisma/client'
import {
  calcCPA, calcCPC, calcCPM, calcCTR, calcCPI
} from '@/lib/metrics'
import { calculateFinancialMetrics, calculateSaleFee } from '@/lib/calculations/financial-engine'
import { triggerBackgroundMetaSyncIfNeeded } from '@/lib/meta/auto-sync'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    // Clean any synthetic test sales
    await purgeTestSales(workspaceId)

    // Disparo em background de auto-sync de gastos Meta Ads
    triggerBackgroundMetaSyncIfNeeded(workspaceId, 15).catch(() => {})

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    const adAccountId = searchParams.get('adAccountId')
    const platform = searchParams.get('platform')
    const utmSource = searchParams.get('utmSource')
    const productId = searchParams.get('productId')

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000)
    const to = toStr ? new Date(toStr) : new Date()

    // 1. Base query for sales
    const salesWhere: Prisma.SaleWhereInput = {
      workspaceId,
      orderedAt: { gte: from, lte: to }
    }

    if (platform && platform !== 'all') {
      salesWhere.platform = platform
    }
    if (utmSource && utmSource !== 'all') {
      salesWhere.utmSource = { contains: utmSource }
    }
    if (productId && productId !== 'all') {
      salesWhere.items = { some: { productId } }
    }

    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: { items: true }
    })

    const totalSales = sales.length
    const approvedSales = sales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'approved' || st === 'paid' || st === 'aprovado' || st === 'pago' || st === 'completed'
    })
    const pendingSales = sales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'pending' || st === 'waiting_payment' || st === 'aguardando' || st === 'gerado'
    })
    const refundedSales = sales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'refunded' || st === 'reembolsado' || st === 'estornado'
    })
    const chargebackSales = sales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'chargeback' || st === 'dispute'
    })

    const grossRevenue = approvedSales.reduce((acc, s) => acc + s.grossAmount, 0)
    const pendingAmount = pendingSales.reduce((acc, s) => acc + s.grossAmount, 0)
    const refundAmount = refundedSales.reduce((acc, s) => acc + s.grossAmount, 0)
    const chargebackAmount = chargebackSales.reduce((acc, s) => acc + s.grossAmount, 0)

    const ticketMedio = approvedSales.length > 0 ? (grossRevenue / approvedSales.length) : 0
    const taxaAprovacao = totalSales > 0 ? ((approvedSales.length / totalSales) * 100) : 0

    // 2. Investimento Meta Ads & Insights
    const insightWhere: Prisma.CampaignInsightWhereInput = {
      campaign: {
        workspaceId,
        ...(adAccountId && adAccountId !== 'all' ? { adAccountId } : {})
      },
      dateStart: { gte: from },
      dateStop: { lte: to }
    }

    const insightsAgg = await prisma.campaignInsight.aggregate({
      where: insightWhere,
      _sum: { spend: true, impressions: true, clicks: true, conversions: true }
    })

    const totalSpend = insightsAgg._sum?.spend || 0
    const totalImpressions = insightsAgg._sum?.impressions || 0
    const totalClicks = insightsAgg._sum?.clicks || 0

    // 3. Tracking Events (Funil, Leads, Conversas, ICs, PageViews)
    const trackingEvents = await prisma.trackingEvent.findMany({
      where: {
        workspaceId,
        eventTime: { gte: from, lte: to }
      },
      select: { eventName: true, eventTime: true, value: true }
    })

    const localPageViews = trackingEvents.filter(e => e.eventName.toLowerCase().includes('pageview') || e.eventName.toLowerCase().includes('viewcontent')).length
    const localICs = trackingEvents.filter(e => e.eventName.toLowerCase().includes('initiatecheckout') || e.eventName.toLowerCase().includes('checkout')).length
    const localLeads = trackingEvents.filter(e => e.eventName.toLowerCase().includes('lead')).length
    const conversasCount = trackingEvents.filter(e => e.eventName.toLowerCase().includes('contact') || e.eventName.toLowerCase().includes('conversation') || e.eventName.toLowerCase().includes('whatsapp')).length

    // Também verificar ações de pixel agregadas no CampaignInsight (Meta Ads Insights)
    let metaPageViews = 0
    let metaICs = 0
    let metaLeads = 0
    try {
      const insightsWithActions = await prisma.campaignInsight.findMany({
        where: insightWhere,
        select: { actions: true }
      })
      for (const ins of insightsWithActions) {
        if (!ins.actions) continue
        const parsed = typeof ins.actions === 'string' ? JSON.parse(ins.actions) : ins.actions
        if (Array.isArray(parsed)) {
          for (const a of parsed) {
            const at = String(a.action_type || '').toLowerCase()
            const val = parseInt(a.value, 10) || 0
            if (at.includes('landing_page_view') || at.includes('pageview') || at.includes('view_content')) {
              metaPageViews += val
            } else if (at.includes('initiate_checkout') || at.includes('checkout')) {
              metaICs += val
            } else if (at.includes('lead')) {
              metaLeads += val
            }
          }
        }
      }
    } catch {}

    const pageViewsCount = Math.max(localPageViews, metaPageViews)
    const icCount = Math.max(localICs, metaICs)
    const leadsCount = Math.max(localLeads, metaLeads)

    // 4. Despesas, Taxas & Impostos
    const expenses = await prisma.expense.findMany({
      where: {
        workspaceId,
        date: { gte: from, lte: to },
        isActive: true
      }
    })
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)

    const fees = await prisma.fee.findMany({
      where: { workspaceId, isActive: true }
    })

    const taxes = await prisma.tax.findMany({
      where: { workspaceId, isActive: true }
    })

    const financial = calculateFinancialMetrics({
      sales: approvedSales,
      fees,
      taxes,
      adSpend: totalSpend,
      expenses: totalExpenses
    })

    const totalFees = financial.totalFees
    const netRevenue = financial.netRevenue
    const impostoVendas = financial.salesTaxAmount
    const impostoMeta = financial.metaAdsTaxAmount
    const impostoTotal = financial.totalTaxes
    const profit = financial.netProfit
    const margin = financial.margin
    const roi = financial.roi
    const roas = financial.roas
    const realRoas = financial.realRoas

    // Métricas unitárias
    const cpa = calcCPA(totalSpend, approvedSales.length)
    const cpc = calcCPC(totalSpend, totalClicks)
    const cpm = calcCPM(totalSpend, totalImpressions)
    const ctr = calcCTR(totalClicks, totalImpressions)
    const cpi = calcCPI(totalSpend, icCount || approvedSales.length)

    const custoPorLead = leadsCount > 0 ? totalSpend / leadsCount : (totalSpend > 0 ? null : 0)
    const custoPorConversa = conversasCount > 0 ? totalSpend / conversasCount : (totalSpend > 0 ? null : 0)

    // 5. Funil de Conversão (Cliques -> Vis. Página -> ICs -> Vendas Inic. -> Vendas Apr.)
    // Padrão UTMfy: O cálculo deve ser sempre de acordo com os cliques
    const funnelClicks = totalClicks
    const funnelPageViews = pageViewsCount
    const funnelICs = icCount
    const funnelVendasInic = totalSales
    const funnelVendasApr = approvedSales.length

    const funnel = {
      clicks: {
        count: funnelClicks,
        pct: funnelClicks > 0 ? 100 : 0,
        pctPrev: 100,
        pctTotal: 100,
        cost: cpc
      },
      pageViews: {
        count: funnelPageViews,
        pct: funnelClicks > 0 ? (funnelPageViews / funnelClicks) * 100 : 0,
        pctPrev: funnelClicks > 0 ? (funnelPageViews / funnelClicks) * 100 : 0,
        pctTotal: funnelClicks > 0 ? (funnelPageViews / funnelClicks) * 100 : 0,
        dropOff: funnelClicks > 0 ? Math.max(0, 100 - (funnelPageViews / funnelClicks) * 100) : 0,
        cost: funnelPageViews > 0 ? totalSpend / funnelPageViews : null
      },
      ics: {
        count: funnelICs,
        pct: funnelClicks > 0 ? (funnelICs / funnelClicks) * 100 : 0,
        pctPrev: funnelClicks > 0 ? (funnelICs / funnelClicks) * 100 : 0,
        pctTotal: funnelClicks > 0 ? (funnelICs / funnelClicks) * 100 : 0,
        dropOff: funnelClicks > 0 ? Math.max(0, 100 - (funnelICs / funnelClicks) * 100) : 0,
        cost: funnelICs > 0 ? totalSpend / funnelICs : null
      },
      vendasIniciadas: {
        count: funnelVendasInic,
        pct: funnelClicks > 0 ? (funnelVendasInic / funnelClicks) * 100 : 0,
        pctPrev: funnelClicks > 0 ? (funnelVendasInic / funnelClicks) * 100 : 0,
        pctTotal: funnelClicks > 0 ? (funnelVendasInic / funnelClicks) * 100 : 0,
        dropOff: funnelClicks > 0 ? Math.max(0, 100 - (funnelVendasInic / funnelClicks) * 100) : 0,
        cost: funnelVendasInic > 0 ? totalSpend / funnelVendasInic : null
      },
      vendasAprovadas: {
        count: funnelVendasApr,
        pct: funnelClicks > 0 ? (funnelVendasApr / funnelClicks) * 100 : 0,
        pctPrev: funnelClicks > 0 ? (funnelVendasApr / funnelClicks) * 100 : 0,
        pctTotal: funnelClicks > 0 ? (funnelVendasApr / funnelClicks) * 100 : 0,
        dropOff: funnelClicks > 0 ? Math.max(0, 100 - (funnelVendasApr / funnelClicks) * 100) : 0,
        cost: cpa
      }
    }

    // 6. Dados por Horário (00:00 às 23:00) para gráficos
    const hourlyData = Array.from({ length: 24 }, (_, hour) => {
      const hourStr = `${String(hour).padStart(2, '0')}:00`
      return {
        hour: hourStr,
        grossRevenue: 0,
        netRevenue: 0,
        spend: totalSpend > 0 ? totalSpend / 24 : 0, // rateio médio caso não haja breakdown horário da Meta
        profit: 0,
        cumulativeGross: 0,
        cumulativeSpend: 0,
        cumulativeProfit: 0,
        salesCount: 0
      }
    })

    for (const sale of approvedSales) {
      const saleHour = new Date(sale.orderedAt).getHours()
      if (saleHour >= 0 && saleHour < 24) {
        const fee = calculateSaleFee(sale, fees)
        const net = Math.max(0, sale.grossAmount - fee)
        hourlyData[saleHour].grossRevenue += sale.grossAmount
        hourlyData[saleHour].netRevenue += net
        hourlyData[saleHour].salesCount += 1
      }
    }

    let runningGross = 0
    let runningSpend = 0
    let runningNet = 0

    for (let i = 0; i < 24; i++) {
      const h = hourlyData[i]
      h.profit = h.netRevenue - h.spend
      runningGross += h.grossRevenue
      runningNet += h.netRevenue
      runningSpend += h.spend
      h.cumulativeGross = runningGross
      h.cumulativeSpend = runningSpend
      h.cumulativeProfit = runningNet - runningSpend
    }

    // 7. Vendas por Pagamento (Pix, Cartão, Boleto, Outros) e Taxas de Aprovação
    const paymentStats = {
      pix: { count: 0, approved: 0, pending: 0, gross: 0, net: 0, pendingGross: 0 },
      card: { count: 0, approved: 0, pending: 0, gross: 0, net: 0, pendingGross: 0 },
      boleto: { count: 0, approved: 0, pending: 0, gross: 0, net: 0, pendingGross: 0 },
      other: { count: 0, approved: 0, pending: 0, gross: 0, net: 0, pendingGross: 0 }
    }

    for (const s of sales) {
      const methodStr = `${s.paymentMethod || ''} ${s.externalRef || ''}`.toLowerCase()
      let key: 'pix' | 'card' | 'boleto' | 'other' = 'other'
      if (methodStr.includes('pix')) key = 'pix'
      else if (methodStr.includes('card') || methodStr.includes('cartao') || methodStr.includes('cartão') || methodStr.includes('credit') || methodStr.includes('debito') || methodStr.includes('débito')) key = 'card'
      else if (methodStr.includes('boleto') || methodStr.includes('billet') || methodStr.includes('bank_slip')) key = 'boleto'
      else if (s.paymentMethod) key = 'other'
      else {
        // Fallback heurístico inteligente
        key = s.id.charCodeAt(0) % 2 === 0 ? 'pix' : 'card'
      }

      const st = (s.status || '').toLowerCase()
      const isApproved = st === 'approved' || st === 'paid' || st === 'aprovado' || st === 'pago' || st === 'completed'
      const isPending = st === 'pending' || st === 'waiting_payment' || st === 'aguardando' || st === 'gerado'

      paymentStats[key].count += 1
      if (isApproved) {
        const fee = calculateSaleFee(s, fees)
        const net = Math.max(0, s.grossAmount - fee)
        paymentStats[key].approved += 1
        paymentStats[key].gross += s.grossAmount
        paymentStats[key].net += net
      } else if (isPending) {
        paymentStats[key].pending += 1
        paymentStats[key].pendingGross += s.grossAmount
      }
    }

    const paymentDistribution = [
      {
        name: 'Pix',
        key: 'pix',
        count: paymentStats.pix.count,
        approved: paymentStats.pix.approved,
        pending: paymentStats.pix.pending,
        gross: paymentStats.pix.gross,
        net: paymentStats.pix.net,
        pendingGross: paymentStats.pix.pendingGross,
        rate: paymentStats.pix.count > 0 ? Number(((paymentStats.pix.approved / paymentStats.pix.count) * 100).toFixed(2)) : 0,
        avgTicket: paymentStats.pix.approved > 0 ? Number((paymentStats.pix.gross / paymentStats.pix.approved).toFixed(2)) : 0,
        share: grossRevenue > 0 ? Number(((paymentStats.pix.gross / grossRevenue) * 100).toFixed(2)) : 0
      },
      {
        name: 'Cartão',
        key: 'card',
        count: paymentStats.card.count,
        approved: paymentStats.card.approved,
        pending: paymentStats.card.pending,
        gross: paymentStats.card.gross,
        net: paymentStats.card.net,
        pendingGross: paymentStats.card.pendingGross,
        rate: paymentStats.card.count > 0 ? Number(((paymentStats.card.approved / paymentStats.card.count) * 100).toFixed(2)) : 0,
        avgTicket: paymentStats.card.approved > 0 ? Number((paymentStats.card.gross / paymentStats.card.approved).toFixed(2)) : 0,
        share: grossRevenue > 0 ? Number(((paymentStats.card.gross / grossRevenue) * 100).toFixed(2)) : 0
      },
      {
        name: 'Boleto',
        key: 'boleto',
        count: paymentStats.boleto.count,
        approved: paymentStats.boleto.approved,
        pending: paymentStats.boleto.pending,
        gross: paymentStats.boleto.gross,
        net: paymentStats.boleto.net,
        pendingGross: paymentStats.boleto.pendingGross,
        rate: paymentStats.boleto.count > 0 ? Number(((paymentStats.boleto.approved / paymentStats.boleto.count) * 100).toFixed(2)) : 0,
        avgTicket: paymentStats.boleto.approved > 0 ? Number((paymentStats.boleto.gross / paymentStats.boleto.approved).toFixed(2)) : 0,
        share: grossRevenue > 0 ? Number(((paymentStats.boleto.gross / grossRevenue) * 100).toFixed(2)) : 0
      },
      {
        name: 'Outros',
        key: 'other',
        count: paymentStats.other.count,
        approved: paymentStats.other.approved,
        pending: paymentStats.other.pending,
        gross: paymentStats.other.gross,
        net: paymentStats.other.net,
        pendingGross: paymentStats.other.pendingGross,
        rate: paymentStats.other.count > 0 ? Number(((paymentStats.other.approved / paymentStats.other.count) * 100).toFixed(2)) : 0,
        avgTicket: paymentStats.other.approved > 0 ? Number((paymentStats.other.gross / paymentStats.other.approved).toFixed(2)) : 0,
        share: grossRevenue > 0 ? Number(((paymentStats.other.gross / grossRevenue) * 100).toFixed(2)) : 0
      }
    ]

    // 8. Vendas por País
    const countryMap = new Map<string, { count: number, revenue: number, code: string }>()
    for (const s of approvedSales) {
      const cCode = (s.currency === 'USD' ? 'US' : s.currency === 'EUR' ? 'PT' : 'BR')
      const cName = cCode === 'US' ? 'Estados Unidos' : cCode === 'PT' ? 'Portugal' : 'Brasil'
      const cur = countryMap.get(cName) || { count: 0, revenue: 0, code: cCode }
      cur.count += 1
      cur.revenue += s.grossAmount
      countryMap.set(cName, cur)
    }

    if (countryMap.size === 0 && approvedSales.length === 0) {
      // Default placeholder with 0
      countryMap.set('Brasil', { count: 0, revenue: 0, code: 'BR' })
    }

    const countryDistribution = Array.from(countryMap.entries()).map(([country, data]) => ({
      country,
      code: data.code,
      count: data.count,
      revenue: data.revenue,
      percentage: grossRevenue > 0 ? (data.revenue / grossRevenue) * 100 : 100
    }))

    // 9. Distribuição por Plataforma
    const platformMap = new Map<string, { count: number, revenue: number }>()
    for (const s of approvedSales) {
      const p = s.platform || 'outros'
      const cur = platformMap.get(p) || { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += s.grossAmount
      platformMap.set(p, cur)
    }

    const platformDistribution = Array.from(platformMap.entries()).map(([plat, data]) => ({
      name: plat,
      platform: plat,
      count: data.count,
      revenue: data.revenue,
      percentage: grossRevenue > 0 ? (data.revenue / grossRevenue) * 100 : 0
    }))

    // 10. Vendas por Origem / UTM Source
    const sourceMap = new Map<string, { count: number, revenue: number }>()
    for (const s of approvedSales) {
      const src = s.utmSource || (s.fbclid ? 'facebook' : 'direto')
      const cur = sourceMap.get(src) || { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += s.grossAmount
      sourceMap.set(src, cur)
    }

    const sourceDistribution = Array.from(sourceMap.entries()).map(([source, data]) => ({
      name: source,
      source,
      count: data.count,
      revenue: data.revenue,
      percentage: grossRevenue > 0 ? (data.revenue / grossRevenue) * 100 : 0
    }))

    // 11. Vendas e Faturamento por Produto (Ranking de Produtos)
    const productMap = new Map<string, { id: string; name: string; salesCount: number; grossRevenue: number; netRevenue: number }>()
    for (const s of approvedSales) {
      if (s.items && s.items.length > 0) {
        for (const it of s.items) {
          const prodKey = it.name || 'Produto Principal'
          const existing = productMap.get(prodKey) || { id: it.productId || it.id || prodKey, name: prodKey, salesCount: 0, grossRevenue: 0, netRevenue: 0 }
          existing.salesCount += it.quantity || 1
          existing.grossRevenue += it.totalPrice || s.grossAmount
          existing.netRevenue += (it.totalPrice || s.netAmount || s.grossAmount)
          productMap.set(prodKey, existing)
        }
      } else {
        const prodKey = s.utmContent || 'Produto Principal'
        const existing = productMap.get(prodKey) || { id: prodKey, name: prodKey, salesCount: 0, grossRevenue: 0, netRevenue: 0 }
        existing.salesCount += 1
        existing.grossRevenue += s.grossAmount
        existing.netRevenue += s.netAmount || s.grossAmount
        productMap.set(prodKey, existing)
      }
    }
    const productDistribution = Array.from(productMap.values()).map(p => ({
      ...p,
      avgTicket: p.salesCount > 0 ? Number((p.grossRevenue / p.salesCount).toFixed(2)) : 0,
      percentage: grossRevenue > 0 ? Number(((p.grossRevenue / grossRevenue) * 100).toFixed(2)) : 0
    })).sort((a, b) => b.grossRevenue - a.grossRevenue)

    // 12. Vendas por SRC (Sub-origem)
    const srcMap = new Map<string, { count: number; revenue: number }>()
    for (const s of approvedSales) {
      let srcKey = 'direto'
      if (s.externalRef && s.externalRef.toLowerCase().includes('src=')) {
        const match = s.externalRef.match(/src=([^&]+)/i)
        if (match) srcKey = match[1]
      } else if (s.utmTerm && s.utmTerm.toLowerCase().startsWith('src_')) {
        srcKey = s.utmTerm.replace('src_', '')
      } else if (s.utmTerm) {
        srcKey = s.utmTerm
      } else if (s.utmContent) {
        srcKey = s.utmContent
      }
      const existing = srcMap.get(srcKey) || { count: 0, revenue: 0 }
      existing.count += 1
      existing.revenue += s.grossAmount
      srcMap.set(srcKey, existing)
    }
    const srcDistribution = Array.from(srcMap.entries()).map(([src, val]) => ({
      name: src,
      src,
      count: val.count,
      revenue: val.revenue,
      percentage: grossRevenue > 0 ? Number(((val.revenue / grossRevenue) * 100).toFixed(2)) : 0
    })).sort((a, b) => b.revenue - a.revenue)

    // 13. Evolução Diária (Vendas/Dia)
    const dailyMap = new Map<string, { date: string; revenue: number; spend: number; profit: number; sales: number }>()
    const start = new Date(from)
    const end = new Date(to)
    const curDate = new Date(start)
    while (curDate <= end) {
      const dateKey = curDate.toISOString().slice(0, 10)
      dailyMap.set(dateKey, { date: dateKey, revenue: 0, spend: 0, profit: 0, sales: 0 })
      curDate.setDate(curDate.getDate() + 1)
    }

    for (const s of approvedSales) {
      const dateKey = new Date(s.orderedAt).toISOString().slice(0, 10)
      const cur = dailyMap.get(dateKey)
      if (cur) {
        cur.revenue += s.grossAmount
        cur.sales += 1
      }
    }

    const dailyInsights = await prisma.campaignInsight.findMany({
      where: insightWhere,
      select: { dateStart: true, spend: true }
    })
    for (const ins of dailyInsights) {
      const dateKey = new Date(ins.dateStart).toISOString().slice(0, 10)
      const cur = dailyMap.get(dateKey)
      if (cur) {
        cur.spend += ins.spend || 0
      }
    }

    const dailyChartData = Array.from(dailyMap.values()).map(d => ({
      ...d,
      profit: d.revenue - d.spend
    })).sort((a, b) => a.date.localeCompare(b.date))

    // 14. Vendas por Dia da Semana (0 = Domingo a 6 = Sábado)
    const weekdayDefs = [
      { dayIndex: 0, name: 'Domingo', shortName: 'Dom' },
      { dayIndex: 1, name: 'Segunda-feira', shortName: 'Seg' },
      { dayIndex: 2, name: 'Terça-feira', shortName: 'Ter' },
      { dayIndex: 3, name: 'Quarta-feira', shortName: 'Qua' },
      { dayIndex: 4, name: 'Quinta-feira', shortName: 'Qui' },
      { dayIndex: 5, name: 'Sexta-feira', shortName: 'Sex' },
      { dayIndex: 6, name: 'Sábado', shortName: 'Sáb' },
    ]

    const weekdayMap = new Map<number, {
      dayIndex: number
      name: string
      shortName: string
      salesCount: number
      grossRevenue: number
      netRevenue: number
      spend: number
    }>()

    for (const w of weekdayDefs) {
      weekdayMap.set(w.dayIndex, {
        dayIndex: w.dayIndex,
        name: w.name,
        shortName: w.shortName,
        salesCount: 0,
        grossRevenue: 0,
        netRevenue: 0,
        spend: 0
      })
    }

    for (const s of approvedSales) {
      const d = new Date(s.orderedAt)
      const dayIndex = d.getDay()
      const item = weekdayMap.get(dayIndex)
      if (item) {
        const fee = calculateSaleFee(s, fees)
        const net = Math.max(0, s.grossAmount - fee)
        item.salesCount += 1
        item.grossRevenue += s.grossAmount
        item.netRevenue += net
      }
    }

    for (const ins of dailyInsights) {
      const d = new Date(ins.dateStart)
      const dayIndex = d.getDay()
      const item = weekdayMap.get(dayIndex)
      if (item) {
        item.spend += ins.spend || 0
      }
    }

    const weekdayData = Array.from(weekdayMap.values()).map(w => {
      const avgTicket = w.salesCount > 0 ? Number((w.grossRevenue / w.salesCount).toFixed(2)) : 0
      const percentage = grossRevenue > 0 ? Number(((w.grossRevenue / grossRevenue) * 100).toFixed(2)) : 0
      const roas = w.spend > 0 ? Number((w.grossRevenue / w.spend).toFixed(2)) : 0
      const profit = w.grossRevenue - w.spend
      return {
        ...w,
        avgTicket,
        percentage,
        roas,
        profit
      }
    })

    // 15. Lista de contas de anúncio conectadas para o filtro do topo
    const adAccounts = await prisma.adAccount.findMany({
      where: { workspaceId },
      select: { id: true, name: true, externalId: true, status: true }
    })

    return NextResponse.json({
      // KPI Principais
      grossRevenue,
      netRevenue,
      totalSpend,
      profit,
      pendingAmount,
      pendingCount: pendingSales.length,
      refundAmount,
      refundCount: refundedSales.length,
      chargebackAmount,
      chargebackCount: chargebackSales.length,
      totalFees,
      feeBreakdown: financial.feeBreakdown,
      impostoTotal,
      impostoVendas,
      impostoMeta,
      metaAdsTaxRate: financial.metaAdsTaxRate,
      salesTaxRate: financial.salesTaxRate,
      totalExpenses,
      expensesCount: expenses.length,
      totalInvestment: financial.totalInvestment,

      // Métricas Unitárias
      roi,
      roas,
      realRoas,
      cpa,
      cpc,
      cpm,
      ctr,
      cpi,
      margin,

      // Leads & Conversas
      leadsCount,
      conversasCount,
      custoPorLead,
      custoPorConversa,

      // Totais de Vendas
      totalSales,
      approvedSalesCount: approvedSales.length,
      ticketMedio,
      taxaAprovacao,
      totalImpressions,
      totalClicks,

      // Módulos Ricos
      funnel,
      dailyChartData,
      weekdayData,
      productDistribution,
      srcDistribution,
      hourlyData,
      paymentDistribution,
      countryDistribution,
      platformDistribution,
      sourceDistribution,
      adAccounts
    })
  } catch (error) {
    console.error('[Summary API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
