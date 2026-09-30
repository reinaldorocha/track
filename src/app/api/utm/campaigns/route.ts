import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import {
  calcCPA, calcROAS, calcROI, calcMargin, calcProfit
} from '@/lib/metrics'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000)
    const to = toStr ? new Date(toStr) : new Date()

    // 1. Agrupar vendas por utmCampaign
    const sales = await prisma.sale.findMany({
      where: {
        workspaceId,
        orderedAt: { gte: from, lte: to }
      },
      select: {
        utmCampaign: true,
        status: true,
        grossAmount: true,
        netAmount: true,
        platform: true,
        orderedAt: true
      }
    })

    // 2. Agrupar sessões por utmCampaign
    const sessions = await prisma.trackingSession.groupBy({
      by: ['utmCampaign'],
      where: {
        workspaceId,
        firstSeenAt: { gte: from, lte: to }
      },
      _count: { id: true }
    })

    // 3. Buscar campanhas do Meta Ads para associar gasto
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        insights: {
          where: {
            dateStart: { gte: from },
            dateStop: { lte: to }
          }
        }
      }
    })

    // Mapear gastos por nome de campanha (comparação case-insensitive ou exata)
    const spendByCampaignName = new Map<string, number>()
    for (const c of campaigns) {
      const totalSpend = c.insights.reduce((acc, ins) => acc + ins.spend, 0)
      spendByCampaignName.set(c.name.toLowerCase().trim(), totalSpend)
    }

    // Estruturar dados por utm_campaign
    const campaignsMap = new Map<string, {
      name: string
      salesCount: number
      approvedSalesCount: number
      grossRevenue: number
      netRevenue: number
      spend: number
      sessions: number
    }>()

    // Preencher com sessões
    for (const s of sessions) {
      const name = s.utmCampaign || 'Orgânico / Direto'
      if (!campaignsMap.has(name)) {
        campaignsMap.set(name, {
          name,
          salesCount: 0,
          approvedSalesCount: 0,
          grossRevenue: 0,
          netRevenue: 0,
          spend: spendByCampaignName.get(name.toLowerCase().trim()) || 0,
          sessions: s._count.id
        })
      } else {
        const existing = campaignsMap.get(name)!
        existing.sessions = s._count.id
      }
    }

    // Preencher com vendas
    for (const sale of sales) {
      const name = sale.utmCampaign || 'Orgânico / Direto'
      if (!campaignsMap.has(name)) {
        campaignsMap.set(name, {
          name,
          salesCount: 0,
          approvedSalesCount: 0,
          grossRevenue: 0,
          netRevenue: 0,
          spend: spendByCampaignName.get(name.toLowerCase().trim()) || 0,
          sessions: 0
        })
      }

      const item = campaignsMap.get(name)!
      item.salesCount += 1
      item.grossRevenue += sale.grossAmount
      item.netRevenue += sale.netAmount
      if (sale.status === 'approved') {
        item.approvedSalesCount += 1
      }
    }

    // Calcular métricas derivadas para cada UTM Campaign
    const rows = Array.from(campaignsMap.values()).map((row) => {
      const profit = calcProfit({
        netRevenue: row.netRevenue,
        adSpend: row.spend,
        productCost: 0,
        fees: 0,
        taxes: 0,
        expenses: 0
      })

      return {
        campaign: row.name,
        sessions: row.sessions,
        sales: row.salesCount,
        approvedSales: row.approvedSalesCount,
        spend: row.spend,
        revenue: row.grossRevenue,
        profit,
        cpa: calcCPA(row.spend, row.approvedSalesCount),
        roas: calcROAS(row.grossRevenue, row.spend),
        roi: calcROI(profit, row.spend),
        margin: calcMargin(profit, row.grossRevenue)
      }
    })

    rows.sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({ campaigns: rows })
  } catch (error) {
    console.error('Error fetching UTM campaigns performance:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
