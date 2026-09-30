import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  normalizeSaleAmount, 
  normalizeNetAmount, 
  normalizeSaleStatus, 
  normalizeSalePaymentMethod, 
  normalizeSaleUtms, 
  upsertSale 
} from '@/lib/integrations/normalizer'
import { createSaleNotification, SaleNotificationType } from '@/lib/notifications/service'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (process.env.YAMPI_WEBHOOK_SECRET && authHeader) {
      const token = authHeader.replace('Bearer ', '')
      if (token !== process.env.YAMPI_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(req.url)
    const queryWs = searchParams.get('workspaceId') || searchParams.get('workspace_id') || req.headers.get('x-workspace-id')

    const body = await req.json()
    const order = body.resource || body

    if (!order) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    let workspaceId: string | null | undefined = queryWs
    if (!workspaceId) {
      const integration = await prisma.integration.findFirst({
        where: { platform: 'yampi' }
      })
      workspaceId = integration?.workspaceId
    }

    if (!workspaceId) {
      const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (!defaultWs) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      workspaceId = defaultWs.id
    }

    const alias = String(order.status?.alias || order.status || 'unknown')
    const status = normalizeSaleStatus(alias, 'yampi')
    const grossPrice = normalizeSaleAmount(body, 'yampi')
    const netPrice = normalizeNetAmount(body, 'yampi', grossPrice)
    const paymentMethod = normalizeSalePaymentMethod(body, 'yampi')
    const utms = normalizeSaleUtms(body)

    const orderId = order.id ? String(order.id) : String(Date.now())
    const idempotencyKey = `yampi_${orderId}_${alias}`
    const existingWebhook = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey }
    })

    if (existingWebhook) {
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    await prisma.webhookEvent.create({
      data: {
        idempotencyKey,
        workspaceId,
        source: 'yampi',
        eventType: alias,
        payload: JSON.stringify(body)
      }
    })

    const createdAt = order.created_at?.date || order.created_at || Date.now()

    const sale = await upsertSale({
      workspaceId,
      platform: 'yampi',
      externalId: orderId,
      externalRef: paymentMethod,
      status,
      grossAmount: grossPrice,
      netAmount: netPrice,
      currency: 'BRL',
      customerEmail: order.customer?.email ? String(order.customer.email) : undefined,
      utmSource: utms.utmSource || order.utm_source,
      utmMedium: utms.utmMedium || order.utm_medium,
      utmCampaign: utms.utmCampaign || order.utm_campaign,
      utmContent: utms.utmContent || order.utm_content,
      utmTerm: utms.utmTerm || order.utm_term,
      fbclid: utms.fbclid,
      fbp: utms.fbp,
      fbc: utms.fbc,
      sessionId: utms.sessionId,
      orderedAt: new Date(createdAt),
      approvedAt: status === 'approved' ? new Date() : undefined,
      refundedAt: status === 'refunded' ? new Date() : undefined
    })

    // Disparo de notificação oficial UTM-Track
    let notifType: SaleNotificationType = 'sale_pending'
    if (status === 'approved') notifType = 'sale_approved'
    else if (status === 'refunded') notifType = 'refund'
    else if (status === 'chargeback') notifType = 'chargeback'
    else if (alias.includes('pix') || paymentMethod === 'pix') notifType = 'pix_pending'

    await createSaleNotification({
      workspaceId,
      type: notifType,
      amount: grossPrice,
      currency: 'BRL',
      platform: 'Yampi',
      saleId: sale.id,
      transactionId: orderId,
    }).catch(e => console.error('Notification dispatch error:', e))

    return NextResponse.json({ success: true, saleId: sale.id })
  } catch (error) {
    console.error('Yampi webhook error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
