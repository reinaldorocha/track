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
    const signature = req.headers.get('x-cakto-signature') || req.headers.get('x-cacto-signature') || req.headers.get('Authorization')
    const secret = process.env.CAKTO_WEBHOOK_SECRET || process.env.CACTO_WEBHOOK_SECRET
    if (secret && signature && signature !== secret && signature !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const queryWs = searchParams.get('workspaceId') || searchParams.get('workspace_id') || req.headers.get('x-workspace-id')

    const body = await req.json()
    const id = body.id || body.data?.id || body.data?.transaction?.id || body.transaction_id || body.order_id
    const rawStatus = (body.status || body.event || body.data?.status || body.data?.event || '').toString()

    if (!id) {
      return NextResponse.json({ error: 'Invalid payload: missing transaction id' }, { status: 400 })
    }

    let workspaceId: string | null | undefined = queryWs
    if (!workspaceId) {
      const integration = await prisma.integration.findFirst({
        where: { platform: { in: ['cakto', 'cacto'] } }
      })
      workspaceId = integration?.workspaceId
    }

    if (!workspaceId) {
      const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (!defaultWs) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      workspaceId = defaultWs.id
    }

    const status = normalizeSaleStatus(rawStatus, 'cakto')
    const grossPrice = normalizeSaleAmount(body, 'cakto')
    const netPrice = normalizeNetAmount(body, 'cakto', grossPrice)
    const paymentMethod = normalizeSalePaymentMethod(body, 'cakto')
    const utms = normalizeSaleUtms(body)

    const idempotencyKey = `cakto_${id}_${status}_${rawStatus}`
    const existingWebhook = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey }
    })

    if (existingWebhook) {
      return NextResponse.json({ success: true, message: 'Already processed (idempotent)' })
    }

    await prisma.webhookEvent.create({
      data: {
        idempotencyKey,
        workspaceId,
        source: 'cakto',
        eventType: rawStatus || 'unknown',
        payload: JSON.stringify(body)
      }
    })

    const email = body.email || body.customer?.email || body.data?.customer?.email || body.data?.buyer?.email
    const created_at = body.created_at || body.data?.created_at || body.createdAt

    const sale = await upsertSale({
      workspaceId,
      platform: 'cakto',
      externalId: id.toString(),
      externalRef: paymentMethod,
      status,
      grossAmount: grossPrice,
      netAmount: netPrice,
      currency: String(body.currency || body.data?.currency || 'BRL'),
      customerEmail: email ? String(email) : undefined,
      utmSource: utms.utmSource,
      utmMedium: utms.utmMedium,
      utmCampaign: utms.utmCampaign,
      utmContent: utms.utmContent,
      utmTerm: utms.utmTerm,
      fbclid: utms.fbclid,
      fbp: utms.fbp,
      fbc: utms.fbc,
      sessionId: utms.sessionId,
      orderedAt: new Date(created_at || Date.now()),
      approvedAt: status === 'approved' ? new Date() : undefined,
      refundedAt: status === 'refunded' ? new Date() : undefined
    })

    // Disparo de notificação oficial UTM-Track
    let notifType: SaleNotificationType = 'sale_pending'
    if (status === 'approved') notifType = 'sale_approved'
    else if (status === 'refunded') notifType = 'refund'
    else if (status === 'chargeback') notifType = 'chargeback'
    else if (rawStatus.toLowerCase().includes('pix') || paymentMethod === 'pix') notifType = 'pix_pending'

    await createSaleNotification({
      workspaceId,
      type: notifType,
      amount: grossPrice,
      currency: String(body.currency || body.data?.currency || 'BRL'),
      platform: 'Cakto',
      saleId: sale.id,
      transactionId: id.toString(),
    }).catch(e => console.error('Notification dispatch error:', e))

    return NextResponse.json({ success: true, saleId: sale.id, status })
  } catch (error) {
    console.error('Cakto webhook error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
