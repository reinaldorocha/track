import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { dispatchNavigationToCapi, buildPurchaseEventId } from '@/lib/meta/capi-service'

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
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

    const platform = body.platform ? String(body.platform).toLowerCase().trim() : undefined
    const pixelId = body.pixelId || searchParams.get('pixelId') || searchParams.get('pixel_id') || undefined

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

    let resolvedPixelDbId: string | null = null
    if (pixelId) {
      const px = await prisma.pixel.findFirst({
        where: {
          workspaceId: workspace.id,
          status: 'active',
          OR: [{ id: pixelId }, { pixelId: pixelId }]
        }
      })
      if (px) resolvedPixelDbId = px.id
    }

    const session = sessionId ? await prisma.trackingSession.findUnique({
      where: { sessionId }
    }) : null

    if (!session) {
      // Create a dummy session or just ignore the event? We will ignore it for now or log it loosely.
      // Better yet, just insert the event if sessionId is missing from DB, as it might be delayed.
    }

    // 1. Para Purchase, verificar se já existe evento gravado para este pedido neste workspace e plataforma (sem correspondência parcial)
    let finalEventId = eventId
    if (eventName === 'Purchase' && orderId) {
      const canonicalId = buildPurchaseEventId(workspace.id, String(orderId), platform)
      const existingPurchase = await prisma.trackingEvent.findFirst({
        where: {
          workspaceId: workspace.id,
          orderId: String(orderId),
          eventName: 'Purchase',
          OR: [
            { eventId: canonicalId },
            ...(platform ? [{ platform }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' }
      })
      if (existingPurchase?.eventId) {
        finalEventId = existingPurchase.eventId
      } else if (!finalEventId || finalEventId.startsWith('evt_')) {
        finalEventId = canonicalId
      }
    }

    // Upsert or create event (check idempotency)
    const existing = await prisma.trackingEvent.findUnique({
      where: { eventId: finalEventId }
    })

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined
    const clientUserAgent = req.headers.get('user-agent') || undefined
    const effectiveIp = clientIp || session?.ipAddress || null
    const effectiveUserAgent = clientUserAgent || session?.userAgent || null
    const numericValue = (value !== undefined && value !== null && value !== '') ? parseFloat(String(value)) : null

    if (!existing) {
      await prisma.trackingEvent.create({
        data: {
          eventId: finalEventId,
          workspaceId: workspace.id,
          pixelId: resolvedPixelDbId,
          sessionId,
          eventName,
          value: numericValue,
          currency,
          orderId,
          platform: platform || undefined,
          contentIds: contentIds ? (typeof contentIds === 'string' ? contentIds : JSON.stringify(contentIds)) : null,
          sourceUrl,
          status: 'received',
          eventTime: new Date(),
          clientIp: effectiveIp,
          clientUserAgent: effectiveUserAgent,
          fbp: session?.fbp || null,
          fbc: session?.fbc || null,
          fbclid: session?.fbclid || null
        }
      })
    } else {
      // Enriquecer dados de matching no evento existente se vieram do navegador
      await prisma.trackingEvent.update({
        where: { id: existing.id },
        data: {
          sessionId: sessionId || existing.sessionId,
          platform: existing.platform || platform || undefined,
          clientIp: existing.clientIp || effectiveIp,
          clientUserAgent: existing.clientUserAgent || effectiveUserAgent,
          fbp: existing.fbp || session?.fbp || null,
          fbc: existing.fbc || session?.fbc || null,
          fbclid: existing.fbclid || session?.fbclid || null
        }
      }).catch(() => {})
    }

    // Disparo para Meta CAPI (PageView, InitiateCheckout, Lead, etc.)
    // NOTA: Eventos 'Purchase' do navegador NÃO são reenviados aqui via CAPI
    // para evitar duplicidade de compra com o webhook do gateway que já dispara o CAPI oficial.
    if (eventName !== 'Purchase') {
      try {
        await dispatchNavigationToCapi({
          workspaceId: workspace.id,
          sessionId,
          eventName,
          eventId,
          sourceUrl,
          value: numericValue !== null ? numericValue : undefined,
          currency,
          contentIds: contentIds ? (typeof contentIds === 'string' ? contentIds : JSON.stringify(contentIds)) : undefined,
          clientIp: effectiveIp || undefined,
          clientUserAgent: effectiveUserAgent || undefined,
          pixelId
        })
      } catch (err: unknown) {
        console.error('[Tracking Event] CAPI dispatch error:', err)
      }
    }

    return NextResponse.json({ success: true, eventId: finalEventId })
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
