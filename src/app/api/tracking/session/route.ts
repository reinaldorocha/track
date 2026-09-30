import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      sessionId,
      visitorId,
      workspaceId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      fbclid,
      fbp,
      fbc,
      landingPage,
      referrer,
      userAgent
    } = body

    if (!sessionId || !workspaceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceId }, { slug: workspaceId }]
      }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Invalid workspace' }, { status: 400 })
    }

    await prisma.trackingSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        visitorId,
        workspaceId: workspace.id,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        fbclid,
        fbp,
        fbc,
        landingPage,
        referrer,
        userAgent,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      },
      update: {
        lastSeenAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Session tracking error:', error)
    return NextResponse.json({ success: true }) // Never expose DB errors, gracefully degrade
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
