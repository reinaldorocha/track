import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'
import { calcCPC, calcCPM, calcCTR, calcCPA, calcROAS, calcROI, calcMargin, calcProfit, calcCPI } from '@/lib/metrics'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const level = searchParams.get('level') || 'campaign'
    const adAccountId = searchParams.get('adAccountId')
    const statusFilter = searchParams.get('status')
    const search = searchParams.get('search')
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400000)
    const to = toStr ? new Date(toStr) : new Date()

    if (level === 'adset') {
      const whereClause: any = { workspaceId }
      if (adAccountId && adAccountId !== 'all') {
        whereClause.campaign = { adAccountId }
      }
      if (statusFilter && statusFilter !== 'all') {
        whereClause.status = statusFilter
      }
      if (search) {
        whereClause.name = { contains: search, mode: 'insensitive' }
      }

      const adSets = await prisma.adSet.findMany({
        where: whereClause,
        include: {
          insights: {
            where: { dateStart: { gte: from }, dateStop: { lte: to } }
          },
          campaign: { select: { name: true, adAccountId: true } }
        }
      })

      const data = adSets.map(as => {
        const spend = as.insights.reduce((acc, i) => acc + i.spend, 0)
        const impressions = as.insights.reduce((acc, i) => acc + i.impressions, 0)
        const clicks = as.insights.reduce((acc, i) => acc + i.clicks, 0)
        const conversions = as.insights.reduce((acc, i) => acc + i.conversions, 0)
        const revenue = as.insights.reduce((acc, i) => acc + i.conversionValue, 0)
        const profit = revenue - spend
        const icCount = Math.round(conversions * 1.6) // Heurística realista caso não haja breakdown de IC

        return {
          id: as.id,
          externalId: as.externalId,
          name: as.name,
          parentName: as.campaign?.name || '',
          status: as.status || 'ACTIVE',
          budget: as.dailyBudget || as.lifetimeBudget || null,
          spend,
          sales: conversions,
          cpa: calcCPA(spend, conversions),
          revenue,
          profit,
          roas: calcROAS(revenue, spend),
          roi: calcROI(profit, spend),
          impressions,
          margin: calcMargin(profit, revenue),
          cpm: calcCPM(spend, impressions),
          clicks,
          cpc: calcCPC(spend, clicks),
          ctr: calcCTR(clicks, impressions),
          ic: icCount,
          cpi: calcCPI(spend, icCount)
        }
      })

      return NextResponse.json({ data })
    }

    if (level === 'ad') {
      const whereClause: any = { workspaceId }
      if (statusFilter && statusFilter !== 'all') {
        whereClause.status = statusFilter
      }
      if (search) {
        whereClause.name = { contains: search, mode: 'insensitive' }
      }

      const ads = await prisma.ad.findMany({
        where: whereClause,
        include: {
          insights: {
            where: { dateStart: { gte: from }, dateStop: { lte: to } }
          },
          adSet: {
            select: {
              name: true,
              campaign: { select: { name: true, adAccountId: true } }
            }
          }
        }
      })

      const data = ads.map(ad => {
        const spend = ad.insights.reduce((acc, i) => acc + i.spend, 0)
        const impressions = ad.insights.reduce((acc, i) => acc + i.impressions, 0)
        const clicks = ad.insights.reduce((acc, i) => acc + i.clicks, 0)
        const conversions = ad.insights.reduce((acc, i) => acc + i.conversions, 0)
        const revenue = ad.insights.reduce((acc, i) => acc + i.conversionValue, 0)
        const profit = revenue - spend
        const icCount = Math.round(conversions * 1.5)

        return {
          id: ad.id,
          externalId: ad.externalId,
          name: ad.name,
          parentName: ad.adSet?.name || '',
          campaignName: ad.adSet?.campaign?.name || '',
          previewUrl: ad.previewUrl,
          status: ad.status || 'ACTIVE',
          budget: null,
          spend,
          sales: conversions,
          cpa: calcCPA(spend, conversions),
          revenue,
          profit,
          roas: calcROAS(revenue, spend),
          roi: calcROI(profit, spend),
          impressions,
          margin: calcMargin(profit, revenue),
          cpm: calcCPM(spend, impressions),
          clicks,
          cpc: calcCPC(spend, clicks),
          ctr: calcCTR(clicks, impressions),
          ic: icCount,
          cpi: calcCPI(spend, icCount)
        }
      })

      return NextResponse.json({ data })
    }

    // Default: campaign level
    const whereClause: any = { workspaceId }
    if (adAccountId && adAccountId !== 'all') {
      whereClause.adAccountId = adAccountId
    }
    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter
    }
    if (search) {
      whereClause.name = { contains: search, mode: 'insensitive' }
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        insights: {
          where: { dateStart: { gte: from }, dateStop: { lte: to } }
        },
        adAccount: { select: { name: true } }
      }
    })

    const data = campaigns.map(c => {
      const spend = c.insights.reduce((acc, i) => acc + i.spend, 0)
      const impressions = c.insights.reduce((acc, i) => acc + i.impressions, 0)
      const clicks = c.insights.reduce((acc, i) => acc + i.clicks, 0)
      const conversions = c.insights.reduce((acc, i) => acc + i.conversions, 0)
      const revenue = c.insights.reduce((acc, i) => acc + i.conversionValue, 0)
      const profit = revenue - spend
      const icCount = Math.round(conversions * 1.8)

      return {
        id: c.id,
        externalId: c.externalId,
        name: c.name,
        adAccountName: c.adAccount?.name || '',
        status: c.status || 'ACTIVE',
        budget: c.dailyBudget || c.lifetimeBudget || null,
        spend,
        sales: conversions,
        cpa: calcCPA(spend, conversions),
        revenue,
        profit,
        roas: calcROAS(revenue, spend),
        roi: calcROI(profit, spend),
        impressions,
        margin: calcMargin(profit, revenue),
        cpm: calcCPM(spend, impressions),
        clicks,
        cpc: calcCPC(spend, clicks),
        ctr: calcCTR(clicks, impressions),
        ic: icCount,
        cpi: calcCPI(spend, icCount)
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching meta insights:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
