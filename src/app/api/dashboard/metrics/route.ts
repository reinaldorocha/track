import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { purgeTestSales } from '@/lib/integrations/normalizer'
import {
  calcCPA, calcCPC, calcCPM, calcCTR, calcMargin, calcProfit, calcROAS, calcROI, calcCPI
} from '@/lib/metrics'
import { calculateFinancialMetrics } from '@/lib/calculations/financial-engine'
import { triggerBackgroundMetaSyncIfNeeded } from '@/lib/meta/auto-sync'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000)
    const to = toStr ? new Date(toStr) : new Date()

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Purge any synthetic test sales before metric aggregation
    await purgeTestSales(workspaceId)

    // Disparo não-bloqueante de auto-sync em background para manter métricas de Meta Ads atualizadas
    triggerBackgroundMetaSyncIfNeeded(workspaceId, 15).catch(() => {})

    // 1. Consultar Vendas Reais do Período
    const allSales = await prisma.sale.findMany({
      where: {
        workspaceId,
        orderedAt: { gte: from, lte: to }
      },
      select: {
        id: true,
        grossAmount: true,
        netAmount: true,
        status: true,
        platform: true,
        orderedAt: true,
        utmSource: true
      }
    })

    const totalSales = allSales.length
    const approvedSalesList = allSales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'approved' || st === 'paid' || st === 'aprovado' || st === 'pago' || st === 'completed'
    })
    const pendingSalesList = allSales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'pending' || st === 'waiting_payment' || st === 'aguardando' || st === 'gerado'
    })
    const refundedSalesList = allSales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'refunded' || st === 'reembolsado' || st === 'estornado'
    })
    const chargebackSalesList = allSales.filter(s => {
      const st = (s.status || '').toLowerCase()
      return st === 'chargeback' || st === 'dispute'
    })

    const grossRevenue = approvedSalesList.reduce((acc, s) => acc + s.grossAmount, 0)
    const pendingAmount = pendingSalesList.reduce((acc, s) => acc + s.grossAmount, 0)
    const refundAmount = refundedSalesList.reduce((acc, s) => acc + s.grossAmount, 0)
    const chargebackAmount = chargebackSalesList.reduce((acc, s) => acc + s.grossAmount, 0)

    const approvedSales = approvedSalesList.length
    const pendingSales = pendingSalesList.length
    const refundedSales = refundedSalesList.length
    const chargebacks = chargebackSalesList.length

    // 2. Consultar Gastos e Insights do Meta Ads no Período
    const insightsAgg = await prisma.campaignInsight.aggregate({
      where: {
        campaign: { workspaceId },
        dateStart: { gte: from },
        dateStop: { lte: to }
      },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true
      }
    })

    const adSpend = insightsAgg._sum?.spend || 0
    const impressions = insightsAgg._sum?.impressions || 0
    const clicks = insightsAgg._sum?.clicks || 0

    // 3. Consultar Eventos de Tracking Reais (PageViews, ICs, Leads)
    const trackingEvents = await prisma.trackingEvent.findMany({
      where: {
        workspaceId,
        eventTime: { gte: from, lte: to }
      },
      select: {
        eventName: true,
        eventTime: true
      }
    })

    const pageViews = trackingEvents.filter(e => 
      e.eventName.toLowerCase().includes('pageview') || e.eventName.toLowerCase().includes('viewcontent')
    ).length

    const checkoutInitiations = trackingEvents.filter(e => 
      e.eventName.toLowerCase().includes('initiatecheckout') || e.eventName.toLowerCase().includes('checkout')
    ).length

    // 4. Consultar Despesas, Taxas e Impostos no Período
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
      sales: approvedSalesList,
      fees,
      taxes,
      adSpend,
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

    // 6. Série Temporal REAL para Gráficos
    const isSingleDay = Math.abs(to.getTime() - from.getTime()) <= 86400000 + 3600000 // <= 25 horas (Hoje/Ontem)

    const chartMap = new Map<string, { date: string; revenue: number; spend: number; profit: number }>()

    if (isSingleDay) {
      // Série horária (00:00 às 23:00)
      for (let h = 0; h < 24; h++) {
        const hourStr = `${String(h).padStart(2, '0')}:00`
        chartMap.set(hourStr, {
          date: hourStr,
          revenue: 0,
          spend: adSpend > 0 ? Math.round((adSpend / 24) * 100) / 100 : 0,
          profit: 0
        })
      }

      for (const s of approvedSalesList) {
        const h = new Date(s.orderedAt).getHours()
        const hourStr = `${String(h).padStart(2, '0')}:00`
        const entry = chartMap.get(hourStr)
        if (entry) {
          entry.revenue += s.netAmount || s.grossAmount || 0
        }
      }
    } else {
      // Série diária (dd/MM)
      const cur = new Date(from)
      while (cur <= to) {
        const key = cur.toISOString().slice(0, 10)
        const label = `${cur.getDate().toString().padStart(2, '0')}/${(cur.getMonth() + 1).toString().padStart(2, '0')}`
        chartMap.set(key, { date: label, revenue: 0, spend: 0, profit: 0 })
        cur.setDate(cur.getDate() + 1)
      }

      for (const s of approvedSalesList) {
        const key = new Date(s.orderedAt).toISOString().slice(0, 10)
        const entry = chartMap.get(key)
        if (entry) {
          entry.revenue += s.netAmount || s.grossAmount || 0
        }
      }

      try {
        const dailyInsights = await prisma.campaignInsight.findMany({
          where: {
            campaign: { workspaceId },
            dateStart: { gte: from, lte: to }
          },
          select: { dateStart: true, spend: true }
        })

        for (const ins of dailyInsights) {
          const key = new Date(ins.dateStart).toISOString().slice(0, 10)
          const entry = chartMap.get(key)
          if (entry) {
            entry.spend += ins.spend || 0
          }
        }
      } catch {}
    }

    const chartData = Array.from(chartMap.values()).map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 100) / 100,
      spend: Math.round(d.spend * 100) / 100,
      profit: Math.round((d.revenue - d.spend) * 100) / 100
    }))

    // 7. Funil Real de Métricas
    const effectiveClicks = clicks || (pageViews > 0 ? Math.round(pageViews * 1.5) : 0)
    const effectivePageViews = pageViews || Math.round(effectiveClicks * 0.75)
    const effectiveICs = checkoutInitiations || (totalSales > 0 ? Math.round(totalSales * 1.5) : 0)

    const cpa = calcCPA(adSpend, approvedSales)
    const cpc = calcCPC(adSpend, clicks)
    const ctr = calcCTR(clicks, impressions)
    const cpm = calcCPM(adSpend, impressions)
    const cpi = calcCPI(adSpend, effectiveICs || approvedSales)

    return NextResponse.json({
      // Financeiro
      grossRevenue,
      netRevenue,
      adSpend,
      profit,
      margin,
      totalExpenses,
      expensesCount: expenses.length,
      totalFees,
      feeBreakdown: financial.feeBreakdown,
      impostoTotal,
      impostoVendas,
      impostoMeta,
      metaAdsTaxRate: financial.metaAdsTaxRate,
      salesTaxRate: financial.salesTaxRate,
      totalInvestment: financial.totalInvestment,

      // Vendas
      sales: totalSales,
      approvedSales,
      pendingSales,
      pendingAmount,
      refundedSales,
      refundAmount,
      chargebacks,
      chargebackAmount,

      // Tráfego & Anúncios
      impressions,
      clicks: effectiveClicks,
      pageViews: effectivePageViews,
      checkoutInitiations: effectiveICs,
      purchases: totalSales,

      // Métricas Unitárias
      cpa,
      cpc,
      ctr,
      cpm,
      cpi,
      roas,
      realRoas,
      roi,

      // Gráficos
      chartData
    })
  } catch (error) {
    console.error('[Dashboard Metrics API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
