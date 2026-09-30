import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  normalizeSaleAmount, 
  normalizeNetAmount, 
  normalizeSaleStatus, 
  normalizeSalePaymentMethod, 
  normalizeSaleInstallments,
  normalizeSaleUtms, 
  isHotmartTestEvent,
  upsertSale 
} from '@/lib/integrations/normalizer'
import { createSaleNotification, SaleNotificationType } from '@/lib/notifications/service'

export async function POST(req: Request) {
  let webhookEventId: string | null = null
  try {
    const { searchParams } = new URL(req.url)
    const queryWs = searchParams.get('workspaceId') || searchParams.get('workspace_id') || req.headers.get('x-workspace-id')

    const payload = await req.json().catch(() => null)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const hottok = req.headers.get('x-hotmart-hottok') || searchParams.get('hottok') || (payload && typeof payload.hottok === 'string' ? payload.hottok : null)
    const expectedSecret = process.env.HOTMART_WEBHOOK_SECRET
    if (expectedSecret) {
      if (!hottok || hottok !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized: missing or invalid hottok token' }, { status: 401 })
      }
    }

    const event = String(payload.event || payload.event_type || 'PURCHASE_APPROVED')
    const data = (payload.data as Record<string, unknown>) || payload
    const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
    
    if (!purchase && !payload.transaction) {
      return NextResponse.json({ error: 'Invalid payload: purchase object missing' }, { status: 400 })
    }

    const transaction = String(purchase.transaction || payload.transaction || payload.id || `HOTMART_${Date.now()}`)

    let workspaceId: string | null | undefined = null
    if (queryWs) {
      const validWs = await prisma.workspace.findUnique({ where: { id: queryWs } })
      if (!validWs) {
        return NextResponse.json({ error: 'Invalid workspaceId' }, { status: 404 })
      }
      workspaceId = validWs.id
    }

    if (!workspaceId) {
      const integration = await prisma.integration.findFirst({ 
        where: { platform: 'hotmart' } 
      })
      workspaceId = integration?.workspaceId
    }

    if (!workspaceId) {
      const defaultWs = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (!defaultWs) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      workspaceId = defaultWs.id
    }

    const idempotencyKey = `hotmart_${transaction}_${event}`
    
    const existingWebhook = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey }
    })

    if (existingWebhook && existingWebhook.status === 'processed') {
      return NextResponse.json({ success: true, message: 'Already processed', idempotencyKey })
    }

    // Registrar evento com status 'processing'
    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        workspaceId,
        source: 'hotmart',
        eventType: event,
        status: 'processing',
        payload: JSON.stringify(payload)
      },
      update: {
        status: 'processing',
        receivedAt: new Date()
      }
    })
    webhookEventId = webhookEvent.id

    // 1. Identificar se é evento sintético de teste da Hotmart
    const headersObj: Record<string, string | null | undefined> = {}
    req.headers.forEach((val, key) => {
      headersObj[key] = val
    })
    const isTest = isHotmartTestEvent(payload, headersObj)

    if (isTest) {
      // Eventos de teste são salvos tecnicamente na Central de Eventos mas NÃO criam faturamento financeiro falso
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
          processedData: JSON.stringify({
            isTest: true,
            event,
            transaction,
            message: 'Hotmart test event processed technically without creating financial sale'
          })
        }
      })

      return NextResponse.json({
        success: true,
        isTest: true,
        message: 'Hotmart test event processed technically. No false financial sale created.'
      })
    }

    // 2. Processamento completo de Evento Real de Venda
    const status = normalizeSaleStatus(event, 'hotmart')
    const paymentMethod = normalizeSalePaymentMethod(payload, 'hotmart')
    const utms = normalizeSaleUtms(payload)
    const grossPrice = normalizeSaleAmount(payload, 'hotmart')
    const netPrice = normalizeNetAmount(payload, 'hotmart', grossPrice)

    const product = (data.product as Record<string, unknown>) || (payload.product as Record<string, unknown>) || {}
    const buyer = (data.buyer as Record<string, unknown>) || (payload.buyer as Record<string, unknown>) || {}
    const priceObj = (purchase.price as Record<string, unknown>) || {}

    const orderDate = purchase.order_date ? new Date(purchase.order_date as number | string) : new Date()
    const approvedDate = purchase.approved_date ? new Date(purchase.approved_date as number | string) : undefined

    const sale = await upsertSale({
      workspaceId,
      platform: 'hotmart',
      externalId: transaction,
      externalRef: paymentMethod,
      paymentMethod,
      installments: normalizeSaleInstallments(payload, 'hotmart'),
      status,
      grossAmount: grossPrice,
      netAmount: netPrice,
      currency: String(priceObj.currency_code || purchase.currency || 'BRL'),
      customerEmail: buyer.email ? String(buyer.email) : undefined,
      customerPhone: (buyer.phone || buyer.checkout_phone) ? String(buyer.phone || buyer.checkout_phone) : undefined,
      utmSource: utms.utmSource,
      utmMedium: utms.utmMedium,
      utmCampaign: utms.utmCampaign,
      utmContent: utms.utmContent,
      utmTerm: utms.utmTerm,
      fbclid: utms.fbclid,
      fbp: utms.fbp,
      fbc: utms.fbc,
      sessionId: utms.sessionId,
      orderedAt: isNaN(orderDate.getTime()) ? new Date() : orderDate,
      approvedAt: status === 'approved' ? (approvedDate && !isNaN(approvedDate.getTime()) ? approvedDate : new Date()) : undefined,
      refundedAt: status === 'refunded' ? new Date() : undefined,
      productInfo: product.name ? {
        id: product.id ? String(product.id) : undefined,
        name: String(product.name),
        sku: product.ucode ? String(product.ucode) : undefined
      } : undefined
    })

    // Atualizar WebhookEvent para status 'processed'
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        status: 'processed',
        processedAt: new Date(),
        processedData: JSON.stringify({
          saleId: sale.id,
          transaction,
          status,
          grossAmount: grossPrice,
          netAmount: netPrice,
          isTest: false
        })
      }
    })

    // Disparo de notificação oficial UTM-Track com som correspondente
    let notifType: SaleNotificationType = 'sale_pending'
    if (status === 'approved') notifType = 'sale_approved'
    else if (status === 'refunded') notifType = 'refund'
    else if (status === 'chargeback') notifType = 'chargeback'
    else if (event.includes('PIX') || paymentMethod === 'pix' || event === 'PURCHASE_BILLET_PRINTED') {
      notifType = paymentMethod === 'pix' || event.includes('PIX') ? 'pix_pending' : 'sale_pending'
    }

    await createSaleNotification({
      workspaceId,
      type: notifType,
      amount: grossPrice,
      currency: String(priceObj.currency_code || purchase.currency || 'BRL'),
      platform: 'Hotmart',
      product: product.name ? String(product.name) : undefined,
      saleId: sale.id,
      transactionId: transaction,
    }).catch(e => console.error('[Hotmart Webhook] Notification dispatch error:', e))

    return NextResponse.json({ 
      success: true, 
      saleId: sale.id, 
      status: sale.status,
      isTest: false 
    })
  } catch (error) {
    console.error('[Hotmart Webhook] Error:', error)
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
