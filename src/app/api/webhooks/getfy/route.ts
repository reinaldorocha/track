import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  normalizeSaleAmount, 
  normalizeNetAmount, 
  normalizeSaleStatus, 
  normalizeSalePaymentMethod, 
  normalizeSaleInstallments,
  normalizeSaleUtms, 
  upsertSale 
} from '@/lib/integrations/normalizer'
import { createSaleNotification, SaleNotificationType } from '@/lib/notifications/service'

export async function POST(req: Request) {
  let webhookEventId: string | null = null
  try {
    const { searchParams } = new URL(req.url)
    const queryWs = searchParams.get('workspaceId') || searchParams.get('workspace_id') || req.headers.get('x-workspace-id')

    // Bearer token ou query token
    const authHeader = req.headers.get('authorization') || ''
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null
    const token = searchParams.get('token') || searchParams.get('signature') || req.headers.get('x-getfy-signature') || bearerToken

    if (process.env.GETFY_WEBHOOK_SECRET && token && token !== process.env.GETFY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await req.json().catch(() => null)
    if (!rawBody) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Suporte tanto ao envelope { event, payload: { ... } } quanto ao payload direto
    const envelopePayload = ((rawBody.payload && typeof rawBody.payload === 'object') ? rawBody.payload : rawBody) as Record<string, unknown>
    const event = String(rawBody.event || envelopePayload.event || envelopePayload.status || 'pedido_pago')

    const order = (envelopePayload.order as Record<string, unknown>) || {}
    const customer = (envelopePayload.customer as Record<string, unknown>) || {}
    const product = (envelopePayload.product as Record<string, unknown>) || (envelopePayload.offer as Record<string, unknown>) || {}

    const orderId = String(order.id || envelopePayload.order_id || envelopePayload.orderId || envelopePayload.id || `GETFY_${Date.now()}`)

    let workspaceId: string | null | undefined = queryWs
    if (!workspaceId) {
      const integration = await prisma.integration.findFirst({
        where: { platform: 'getfy' }
      })
      workspaceId = integration?.workspaceId
    }

    if (!workspaceId) {
      const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (!defaultWs) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      workspaceId = defaultWs.id
    }

    const status = normalizeSaleStatus(event, 'getfy')
    const grossPrice = normalizeSaleAmount(envelopePayload, 'getfy')
    const netPrice = normalizeNetAmount(envelopePayload, 'getfy', grossPrice)
    const paymentMethod = normalizeSalePaymentMethod(envelopePayload, 'getfy')
    const utms = normalizeSaleUtms(envelopePayload)
    const currency = String(order.currency || envelopePayload.currency || 'BRL')

    const idempotencyKey = `getfy_${orderId}_${status}`
    const existingWebhook = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey }
    })

    if (existingWebhook && existingWebhook.status === 'processed') {
      return NextResponse.json({ success: true, message: 'Already processed (idempotent)', idempotencyKey })
    }

    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        workspaceId,
        source: 'getfy',
        eventType: event,
        status: 'processing',
        payload: JSON.stringify(rawBody)
      },
      update: {
        status: 'processing',
        receivedAt: new Date()
      }
    })
    webhookEventId = webhookEvent.id

    const email = (customer.email || order.email || envelopePayload.email)
      ? String(customer.email || order.email || envelopePayload.email)
      : undefined
    const phone = (customer.phone || customer.mobile || order.phone || envelopePayload.phone)
      ? String(customer.phone || customer.mobile || order.phone || envelopePayload.phone)
      : undefined

    const createdAt = order.created_at || envelopePayload.created_at || envelopePayload.createdAt || Date.now()
    const paidAt = envelopePayload.paidAt || (status === 'approved' ? (order.updated_at || new Date()) : undefined)

    const sale = await upsertSale({
      workspaceId,
      platform: 'getfy',
      externalId: orderId,
      externalRef: paymentMethod,
      paymentMethod,
      installments: normalizeSaleInstallments(envelopePayload, 'getfy'),
      status,
      grossAmount: grossPrice,
      netAmount: netPrice,
      currency,
      customerEmail: email,
      customerPhone: phone,
      utmSource: utms.utmSource,
      utmMedium: utms.utmMedium,
      utmCampaign: utms.utmCampaign,
      utmContent: utms.utmContent,
      utmTerm: utms.utmTerm,
      fbclid: utms.fbclid,
      fbp: utms.fbp,
      fbc: utms.fbc,
      sessionId: utms.sessionId,
      orderedAt: new Date(createdAt as string | number),
      approvedAt: status === 'approved' ? (paidAt ? new Date(paidAt as string | number) : new Date()) : undefined,
      refundedAt: status === 'refunded' ? new Date() : undefined,
      productInfo: (product.name || product.title) ? {
        id: product.id ? String(product.id) : undefined,
        name: String(product.name || product.title),
      } : undefined
    })

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: 'processed',
        processedAt: new Date(),
        processedData: JSON.stringify({
          saleId: sale.id,
          orderId,
          status,
          grossAmount: grossPrice,
          netAmount: netPrice
        })
      }
    })

    // Notificação oficial com som correspondente
    let notifType: SaleNotificationType = 'sale_pending'
    if (status === 'approved') notifType = 'sale_approved'
    else if (status === 'refunded') notifType = 'refund'
    else if (status === 'chargeback') notifType = 'chargeback'
    else if (event === 'pix_gerado' || paymentMethod === 'pix') notifType = 'pix_pending'

    await createSaleNotification({
      workspaceId,
      type: notifType,
      amount: grossPrice,
      currency,
      platform: 'Getfy',
      product: (product.name || product.title) ? String(product.name || product.title) : undefined,
      saleId: sale.id,
      transactionId: orderId,
    }).catch(e => console.error('[Getfy Webhook] Notification dispatch error:', e))

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      status: sale.status,
      idempotencyKey
    })
  } catch (error) {
    console.error('[Getfy Webhook] Error:', error)
    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date()
        }
      }).catch(() => {})
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
