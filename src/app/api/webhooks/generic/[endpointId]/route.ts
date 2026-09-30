import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import { 
  normalizeSaleAmount, 
  normalizeNetAmount, 
  normalizeSaleStatus, 
  normalizeSalePaymentMethod, 
  normalizeSaleUtms, 
  upsertSale 
} from '@/lib/integrations/normalizer'
import { createSaleNotification, SaleNotificationType } from '@/lib/notifications/service'

export async function POST(req: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  try {
    const { endpointId } = await params
    
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { endpointId }
    })

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const rawBody = await req.text()
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(rawBody || '{}')
    } catch {
      payload = {}
    }

    const eventId = String(payload.id || payload.transaction_id || payload.order_id || uuid())
    const idempotencyKey = `generic_${endpointId}_${eventId}`

    await prisma.webhookEvent.create({
      data: {
        idempotencyKey,
        workspaceId: endpoint.workspaceId,
        endpointId: endpoint.endpointId,
        source: 'generic',
        eventType: String(payload.event || payload.status || 'generic_event'),
        payload: rawBody || '{}'
      }
    })

    await prisma.webhookEndpoint.update({
      where: { endpointId },
      data: {
        eventCount: { increment: 1 },
        lastEventAt: new Date()
      }
    })

    // Processar venda caso contenha valor/pedido
    const grossPrice = normalizeSaleAmount(payload, 'generic')
    if (grossPrice > 0 || payload.order_id || payload.transaction_id || payload.id) {
      const netPrice = normalizeNetAmount(payload, 'generic', grossPrice)
      const rawStatus = String(payload.status || payload.event || payload.order_status || 'approved')
      const status = normalizeSaleStatus(rawStatus, 'generic')
      const paymentMethod = normalizeSalePaymentMethod(payload, 'generic')
      const utms = normalizeSaleUtms(payload)

      const sale = await upsertSale({
        workspaceId: endpoint.workspaceId,
        platform: 'generic',
        externalId: eventId,
        externalRef: paymentMethod,
        status,
        grossAmount: grossPrice,
        netAmount: netPrice,
        currency: String(payload.currency || 'BRL'),
        customerEmail: String(payload.email || (payload.customer as Record<string, unknown>)?.email || ''),
        utmSource: utms.utmSource,
        utmMedium: utms.utmMedium,
        utmCampaign: utms.utmCampaign,
        utmContent: utms.utmContent,
        utmTerm: utms.utmTerm,
        fbclid: utms.fbclid,
        fbp: utms.fbp,
        fbc: utms.fbc,
        sessionId: utms.sessionId,
        orderedAt: new Date(String(payload.created_at || payload.ordered_at || Date.now())),
        approvedAt: status === 'approved' ? new Date() : undefined,
        refundedAt: status === 'refunded' ? new Date() : undefined
      })

      if (status === 'approved' || status === 'pending') {
        const notifType: SaleNotificationType = status === 'approved' ? 'sale_approved' : 'sale_pending'
        await createSaleNotification({
          workspaceId: endpoint.workspaceId,
          type: notifType,
          amount: grossPrice,
          currency: String(payload.currency || 'BRL'),
          platform: 'Webhook Genérico',
          saleId: sale.id,
          transactionId: eventId,
        }).catch(e => console.error('Notification error:', e))
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Generic webhook error:', error)
    return NextResponse.json({ success: true })
  }
}
