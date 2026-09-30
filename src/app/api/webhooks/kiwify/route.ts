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
    const token = searchParams.get('token') || searchParams.get('signature') || req.headers.get('x-kiwify-signature')

    if (process.env.KIWIFY_WEBHOOK_SECRET && token && token !== process.env.KIWIFY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json().catch(() => null)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const orderId = String(payload.order_id || payload.orderId || payload.id || `KIWIFY_${Date.now()}`)
    const rawStatus = String(payload.order_status || payload.status || 'paid')

    let workspaceId: string | null | undefined = queryWs
    if (!workspaceId) {
      const integration = await prisma.integration.findFirst({
        where: { platform: 'kiwify' }
      })
      workspaceId = integration?.workspaceId
    }

    if (!workspaceId) {
      const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (!defaultWs) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      workspaceId = defaultWs.id
    }

    const status = normalizeSaleStatus(rawStatus, 'kiwify')
    const grossPrice = normalizeSaleAmount(payload, 'kiwify')
    const netPrice = normalizeNetAmount(payload, 'kiwify', grossPrice)
    const paymentMethod = normalizeSalePaymentMethod(payload, 'kiwify')
    const utms = normalizeSaleUtms(payload)

    const idempotencyKey = `kiwify_${orderId}_${status}`
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
        source: 'kiwify',
        eventType: rawStatus,
        status: 'processing',
        payload: JSON.stringify(payload)
      },
      update: {
        status: 'processing',
        receivedAt: new Date()
      }
    })
    webhookEventId = webhookEvent.id

    const customer = (payload.Customer as Record<string, unknown>) || (payload.customer as Record<string, unknown>) || {}
    const product = (payload.Product as Record<string, unknown>) || (payload.product as Record<string, unknown>) || {}
    const commissions = (payload.Commissions as Record<string, unknown>) || (payload.commissions as Record<string, unknown>) || {}

    const email = customer.email ? String(customer.email) : undefined
    const phone = customer.mobile || customer.phone ? String(customer.mobile || customer.phone) : undefined
    const createdAt = payload.created_at || payload.createdAt || Date.now()

    const sale = await upsertSale({
      workspaceId,
      platform: 'kiwify',
      externalId: orderId,
      externalRef: paymentMethod,
      paymentMethod,
      installments: normalizeSaleInstallments(payload, 'kiwify'),
      status,
      grossAmount: grossPrice,
      netAmount: netPrice,
      currency: String(commissions.currency || payload.currency || 'BRL'),
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
      orderedAt: new Date(createdAt),
      approvedAt: status === 'approved' ? (payload.approved_date ? new Date(payload.approved_date) : new Date()) : undefined,
      refundedAt: status === 'refunded' ? new Date() : undefined,
      productInfo: product.product_name || product.name ? {
        id: product.product_id ? String(product.product_id) : undefined,
        name: String(product.product_name || product.name),
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

    // Disparo de notificação oficial com som correspondente
    let notifType: SaleNotificationType = 'sale_pending'
    if (status === 'approved') notifType = 'sale_approved'
    else if (status === 'refunded') notifType = 'refund'
    else if (status === 'chargeback') notifType = 'chargeback'
    else if (rawStatus.toLowerCase().includes('pix') || paymentMethod === 'pix') notifType = 'pix_pending'

    await createSaleNotification({
      workspaceId,
      type: notifType,
      amount: grossPrice,
      currency: String(commissions.currency || payload.currency || 'BRL'),
      platform: 'Kiwify',
      product: product.product_name ? String(product.product_name) : undefined,
      saleId: sale.id,
      transactionId: orderId,
    }).catch(e => console.error('[Kiwify Webhook] Notification dispatch error:', e))

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      status: sale.status,
      idempotencyKey
    })
  } catch (error) {
    console.error('[Kiwify Webhook] Error:', error)
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
