import { prisma } from '@/lib/db'

export async function attemptAttribution(saleId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } })
  if (!sale) return null
  
  // Check if already attributed
  const existing = await prisma.attributionRecord.findUnique({ where: { saleId } })
  if (existing) return existing
  
  let session = null
  let matchedBy = ''
  
  // 1. Match direto por sessionId no workspace da venda
  if (sale.sessionId) {
    session = await prisma.trackingSession.findFirst({
      where: { sessionId: sale.sessionId, workspaceId: sale.workspaceId }
    })
    if (session) matchedBy = 'session'
  }

  // 2. Try to match by fbclid
  if (!session && sale.fbclid) {
    session = await prisma.trackingSession.findFirst({
      where: { workspaceId: sale.workspaceId, fbclid: sale.fbclid },
      orderBy: { firstSeenAt: 'desc' }
    })
    if (session) matchedBy = 'fbclid'
  }
  
  // 3. Try to match by fbp
  if (!session && sale.fbp) {
    session = await prisma.trackingSession.findFirst({
      where: { workspaceId: sale.workspaceId, fbp: sale.fbp },
      orderBy: { firstSeenAt: 'desc' }
    })
    if (session) matchedBy = 'fbp'
  }
  
  // 4. Try UTM campaign match (less reliable)
  if (!session && sale.utmCampaign) {
    session = await prisma.trackingSession.findFirst({
      where: { workspaceId: sale.workspaceId, utmCampaign: sale.utmCampaign },
      orderBy: { firstSeenAt: 'desc' }
    })
    if (session) matchedBy = 'utm'
  }
  
  if (!session) return null
  
  // Create attribution record
  return await prisma.attributionRecord.create({
    data: {
      workspaceId: sale.workspaceId,
      saleId,
      sessionId: session.sessionId,
      adId: session.adId,
      adSetId: session.adSetId,
      campaignId: session.campaignId,
      adAccountId: session.adAccountId,
      model: 'last_click',
      confidence: matchedBy === 'session' ? 1.0 : matchedBy === 'fbclid' ? 1.0 : matchedBy === 'fbp' ? 0.9 : 0.5,
      matchedBy,
      fbclid: sale.fbclid || session.fbclid,
      utmCampaign: sale.utmCampaign || session.utmCampaign
    }
  })
}
