import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import {
  calcROAS, calcROI, calcMargin, calcProfit, calcCPA
} from '@/lib/metrics'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const reportType = searchParams.get('type') || 'campaign'
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    const format = searchParams.get('format') || 'json'

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000)
    const to = toStr ? new Date(toStr) : new Date()

    let reportRows: Array<{
      item: string
      sales: number
      revenue: number
      spend: number
      profit: number
      cpa: number | null
      roas: number | null
      margin: number | null
    }> = []

    if (reportType === 'campaign') {
      const campaigns = await prisma.campaign.findMany({
        where: { workspaceId },
        include: {
          insights: {
            where: { dateStart: { gte: from }, dateStop: { lte: to } }
          }
        }
      })

      const sales = await prisma.sale.findMany({
        where: { workspaceId, orderedAt: { gte: from, lte: to } }
      })

      reportRows = campaigns.map(c => {
        const spend = c.insights.reduce((acc, i) => acc + i.spend, 0)
        const campSales = sales.filter(s => s.utmCampaign?.toLowerCase() === c.name.toLowerCase())
        const revenue = campSales.reduce((acc, s) => acc + s.grossAmount, 0)
        const netRev = campSales.reduce((acc, s) => acc + s.netAmount, 0)
        const profit = calcProfit({ netRevenue: netRev || (revenue * 0.9), adSpend: spend, productCost: 0, fees: 0, taxes: 0, expenses: 0 })

        return {
          item: c.name,
          sales: campSales.length,
          revenue,
          spend,
          profit,
          cpa: calcCPA(spend, campSales.length),
          roas: calcROAS(revenue, spend),
          margin: calcMargin(profit, revenue)
        }
      })
    } else if (reportType === 'platform') {
      const sales = await prisma.sale.findMany({
        where: { workspaceId, orderedAt: { gte: from, lte: to } }
      })

      const map = new Map<string, { sales: number, revenue: number, netRev: number }>()
      for (const s of sales) {
        const p = s.platform || 'outros'
        const cur = map.get(p) || { sales: 0, revenue: 0, netRev: 0 }
        cur.sales += 1
        cur.revenue += s.grossAmount
        cur.netRev += s.netAmount
        map.set(p, cur)
      }

      reportRows = Array.from(map.entries()).map(([platform, val]) => {
        const profit = val.netRev
        return {
          item: platform.toUpperCase(),
          sales: val.sales,
          revenue: val.revenue,
          spend: 0,
          profit,
          cpa: null,
          roas: null,
          margin: calcMargin(profit, val.revenue)
        }
      })
    } else {
      // Por UTM
      const sales = await prisma.sale.findMany({
        where: { workspaceId, orderedAt: { gte: from, lte: to } }
      })

      const map = new Map<string, { sales: number, revenue: number, netRev: number }>()
      for (const s of sales) {
        const u = s.utmCampaign || 'Direto / Sem UTM'
        const cur = map.get(u) || { sales: 0, revenue: 0, netRev: 0 }
        cur.sales += 1
        cur.revenue += s.grossAmount
        cur.netRev += s.netAmount
        map.set(u, cur)
      }

      reportRows = Array.from(map.entries()).map(([utm, val]) => {
        const profit = val.netRev
        return {
          item: utm,
          sales: val.sales,
          revenue: val.revenue,
          spend: 0,
          profit,
          cpa: null,
          roas: null,
          margin: calcMargin(profit, val.revenue)
        }
      })
    }

    if (format === 'csv') {
      const headers = ['Item', 'Vendas', 'Faturamento (R$)', 'Investimento (R$)', 'Lucro (R$)', 'CPA', 'ROAS', 'Margem (%)']
      const csvLines = [headers.join(';')]

      for (const r of reportRows) {
        csvLines.push([
          `"${r.item.replace(/"/g, '""')}"`,
          r.sales,
          r.revenue.toFixed(2),
          r.spend.toFixed(2),
          r.profit.toFixed(2),
          r.cpa !== null ? r.cpa.toFixed(2) : '',
          r.roas !== null ? r.roas.toFixed(2) : '',
          r.margin !== null ? r.margin.toFixed(2) : ''
        ].join(';'))
      }

      const csvContent = csvLines.join('\n')
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="relatorio-${reportType}-${from.toISOString().split('T')[0]}.csv"`
        }
      })
    }

    return NextResponse.json({ report: reportRows })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
