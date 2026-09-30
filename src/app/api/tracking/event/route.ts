import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { dispatchNavigationToCapi } from '@/lib/meta/capi-service'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      sessionId,
      workspaceId,
      eventName,
      eventId,
      value,
      currency,
      orderId,
      contentIds,
      sourceUrl
    } = body

    if (!eventId || !workspaceId || !eventName) {
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

    const session = await prisma.trackingSession.findUnique({
      where: { sessionId }
    })

    if (!session) {
      // Create a dummy session or just ignore the event? We will ignore it for now or log it loosely.
      // Better yet, just insert the event if sessionId is missing from DB, as it might be delayed.
    }

    // Upsert or create event (check idempotency)
    const existing = await prisma.trackingEvent.findUnique({
      where: { eventId }
    })

    if (!existing) {
      await prisma.trackingEvent.create({
        data: {
          eventId,
          workspaceId: workspace.id,
          sessionId,
          eventName,
          value: value ? parseFloat(value) : null,
          currency,
          orderId,
          contentIds: contentIds ? JSON.stringify(contentIds) : null,
          sourceUrl,
          status: 'received',
          eventTime: new Date()
        }
      })

      // Disparo para Meta CAPI (PageView, InitiateCheckout, Lead, etc.)
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined
      const clientUserAgent = req.headers.get('user-agent') || undefined

      try {
        await dispatchNavigationToCapi({
          workspaceId: workspace.id,
          sessionId,
          eventName,
          eventId,
          sourceUrl,
          value: value ? parseFloat(value) : undefined,
          currency,
          contentIds: contentIds ? JSON.stringify(contentIds) : undefined,
          clientIp,
          clientUserAgent
        })
      } catch (err: unknown) {
        console.error('[Tracking Event] CAPI dispatch error:', err)
      }
    }

    return NextResponse.json({ success: true, eventId })
  } catch (error) {
    console.error('Event tracking error:', error)
    return NextResponse.json({ success: false, error: 'Event tracking failed' }, { status: 500 })
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
