import { prisma } from '@/lib/db'
import { attemptAttribution } from '@/lib/tracking/attribution'
import { dispatchPurchaseToCapi } from '@/lib/meta/capi-service'

export interface InternalSale {
  workspaceId: string
  platform: string
  externalId: string
  externalRef?: string
  status: 'approved' | 'pending' | 'refunded' | 'chargeback' | 'cancelled'
  paymentMethod?: string
  installments?: number
  grossAmount: number
  netAmount: number
  currency: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  fbp?: string
  fbc?: string
  sessionId?: string
  customerEmail?: string
  customerPhone?: string
  clientIp?: string
  clientUserAgent?: string
  orderedAt: Date
  approvedAt?: Date
  refundedAt?: Date
  productInfo?: {
    id?: string | number
    name?: string
    sku?: string
  }
}

/**
 * Identifica se um payload enviado pela Hotmart é um evento sintético de teste
 */
export function isHotmartTestEvent(
  payload: Record<string, unknown>,
  headers?: Record<string, string | null | undefined>
): boolean {
  if (!payload) return false

  // 1. Headers HTTP indicativos de teste
  if (headers) {
    const hTest = String(headers['x-hotmart-test'] || headers['x-hotmart-event-test'] || headers['x-test-event'] || '').toLowerCase()
    if (hTest === 'true' || hTest === '1') return true
  }

  // 2. Flags explícitas no payload
  if (
    payload.is_test === true ||
    payload.test === true ||
    payload.sandbox === true ||
    payload.event_type === 'TEST' ||
    payload.mode === 'test' ||
    String(payload.environment || '').toLowerCase() === 'test' ||
    String(payload.environment || '').toLowerCase() === 'sandbox'
  ) {
    return true
  }

  const data = (payload.data as Record<string, unknown>) || {}
  if (data.is_test === true || data.test === true || data.sandbox === true) {
    return true
  }

  const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
  if (purchase.is_test === true || purchase.test === true || purchase.sandbox === true) {
    return true
  }

  const buyer = (data.buyer as Record<string, unknown>) || (payload.buyer as Record<string, unknown>) || {}
  const buyerEmail = String(buyer.email || '').toLowerCase().trim()
  const buyerName = String(buyer.name || '').toLowerCase().trim()
  const transaction = String(purchase.transaction || payload.transaction || '').toUpperCase().trim()
  const product = (data.product as Record<string, unknown>) || (payload.product as Record<string, unknown>) || {}
  const productName = String(product.name || payload.product_name || '').toLowerCase().trim()

  // 3. Transações de teste oficiais da Hotmart e ferramentas de webhook
  if (
    transaction === 'HP00000000000001' ||
    transaction.startsWith('HP00000000') ||
    transaction.startsWith('TEST_') ||
    transaction.startsWith('SANDBOX_') ||
    transaction.startsWith('MOCK_') ||
    transaction.includes('TEST') ||
    transaction.includes('TESTE')
  ) {
    return true
  }

  // 4. E-mails e compradores de teste da Hotmart
  if (
    buyerEmail === 'teste@hotmart.com' ||
    buyerEmail === 'test@hotmart.com' ||
    buyerEmail === 'compradorteste@hotmart.com' ||
    buyerEmail.endsWith('@hotmart.com') ||
    buyerEmail.endsWith('@example.com') ||
    buyerEmail.endsWith('@test.com') ||
    buyerEmail.endsWith('@teste.com') ||
    buyerEmail.includes('teste@') ||
    buyerEmail.includes('test@')
  ) {
    return true
  }

  // 5. Nomes de produto com marcação de teste
  if (
    productName.includes('produto de teste') ||
    productName.includes('produto test') ||
    productName.includes('test postback') ||
    productName.includes('postback2') ||
    productName.includes('sandbox') ||
    productName.includes('sample product') ||
    productName.includes('dummy') ||
    productName.includes('mock')
  ) {
    return true
  }

  if (buyerName.includes('comprador teste') || buyerName.includes('test buyer') || buyerName === 'teste') {
    return true
  }

  return false
}

/**
 * Identifica se um registro de Sale existente no banco é originário de teste sintético
 */
export function isTestSaleRecord(sale: {
  externalId?: string | null
  customerEmail?: string | null
  platform?: string | null
  items?: Array<{ name?: string | null }> | null
}): boolean {
  if (!sale) return false
  const ext = String(sale.externalId || '').toUpperCase()
  const email = String(sale.customerEmail || '').toLowerCase()

  if (
    ext.startsWith('HP00000000') ||
    ext === 'HP00000000000001' ||
    ext.startsWith('TEST_') ||
    ext.startsWith('SANDBOX_') ||
    ext.startsWith('MOCK_') ||
    ext.includes('TEST') ||
    ext.includes('TESTE')
  ) {
    return true
  }

  if (
    email === 'teste@hotmart.com' ||
    email === 'test@hotmart.com' ||
    email === 'compradorteste@hotmart.com' ||
    email.endsWith('@hotmart.com') ||
    email.endsWith('@example.com') ||
    email.endsWith('@test.com') ||
    email.endsWith('@teste.com') ||
    email.includes('teste@') ||
    email.includes('test@')
  ) {
    return true
  }

  if (
    sale.items &&
    sale.items.some((i) => {
      const n = String(i.name || '').toLowerCase()
      return (
        n.includes('produto de teste') ||
        n.includes('produto test') ||
        n.includes('test postback') ||
        n.includes('postback2') ||
        n.includes('sandbox') ||
        n.includes('sample product') ||
        n.includes('dummy') ||
        n.includes('mock')
      )
    })
  ) {
    return true
  }

  return false
}

/**
 * Remove com segurança do banco de dados qualquer registro de Sale oriundo de testes sintéticos
 */
export async function purgeTestSales(workspaceId?: string): Promise<number> {
  try {
    const whereClause: Record<string, unknown> = workspaceId ? { workspaceId } : {}
    const candidateSales = await prisma.sale.findMany({
      where: whereClause,
      include: { items: true }
    })

    const testSaleIds = candidateSales
      .filter(sale => isTestSaleRecord(sale))
      .map(sale => sale.id)

    if (testSaleIds.length > 0) {
      await prisma.sale.deleteMany({
        where: { id: { in: testSaleIds } }
      })
      console.log(`[Purge] Successfully deleted ${testSaleIds.length} synthetic test sale(s).`)
    }
    return testSaleIds.length
  } catch (error) {
    console.error('[Purge] Error purging test sales:', error)
    return 0
  }
}


/**
 * Normaliza valores monetários vindos de qualquer gateway ou payload
 */
export function normalizeSaleAmount(payload: Record<string, unknown>, provider = 'generic'): number {
  if (!payload) return 0

  let rawVal: unknown = undefined

  const pLower = (provider || '').toLowerCase()
  const data = (payload.data as Record<string, unknown>) || {}
  const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
  const resource = (payload.resource as Record<string, unknown>) || {}

  if (pLower.includes('hotmart')) {
    const priceObj = (purchase.price as Record<string, unknown>) || {}
    const origObj = (purchase.original_offer_price as Record<string, unknown>) || {}
    const fullObj = (purchase.full_price as Record<string, unknown>) || {}
    rawVal = priceObj.value ?? origObj.value ?? fullObj.value ?? purchase.price ?? purchase.original_offer_price
  } else if (pLower.includes('cakto') || pLower.includes('cacto')) {
    rawVal = payload.amount ?? data.amount ?? data.price ?? data.total ?? payload.value ?? payload.price
  } else if (pLower.includes('getfy')) {
    const order = (payload.order as Record<string, unknown>) || {}
    const offer = (payload.offer as Record<string, unknown>) || {}
    rawVal = payload.amount ?? order.amount ?? offer.price ?? payload.total ?? payload.value
  } else if (pLower.includes('kiwify')) {
    const commissions = (payload.Commissions as Record<string, unknown>) || {}
    const order = (payload.Order as Record<string, unknown>) || {}
    rawVal =
      commissions.charge_amount ??
      payload.order_amount ??
      order.order_total ??
      payload.charge_amount ??
      payload.amount ??
      payload.price
    if (typeof rawVal === 'number' && rawVal > 500 && rawVal % 1 === 0 && commissions.charge_amount !== undefined) {
      rawVal = rawVal / 100
    }
  } else if (pLower.includes('yampi')) {
    rawVal = resource.value ?? resource.total ?? payload.value ?? payload.total
  } else if (pLower.includes('shopify')) {
    rawVal = payload.total_price ?? payload.current_total_price ?? payload.subtotal_price
  } else {
    // Genérico / Outros gateways
    rawVal =
      payload.grossAmount ??
      payload.amount ??
      payload.total_amount ??
      payload.order_amount ??
      payload.value ??
      payload.price ??
      payload.total ??
      data.amount ??
      data.value ??
      data.price ??
      data.total
  }

  if (rawVal === undefined || rawVal === null) return 0

  if (typeof rawVal === 'number') {
    return isNaN(rawVal) ? 0 : Math.round(rawVal * 100) / 100
  }

  if (typeof rawVal === 'string') {
    // Tratar formatos como "1.299,00" ou "197.00" ou "R$ 197,00"
    const cleaned = rawVal.replace(/[R$\s]/g, '').trim()
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Formato brasileiro "1.299,50" -> 1299.50
      const parsed = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100
    } else if (cleaned.includes(',')) {
      // Formato com vírgula "197,50" -> 197.50
      const parsed = parseFloat(cleaned.replace(',', '.'))
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100
    } else {
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100
    }
  }

  return 0
}

/**
 * Normaliza o valor líquido da venda
 */
export function normalizeNetAmount(
  payload: Record<string, unknown>,
  provider = 'generic',
  grossAmount: number
): number {
  if (!payload) return grossAmount

  const pLower = (provider || '').toLowerCase()
  const data = (payload.data as Record<string, unknown>) || {}
  const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
  const resource = (payload.resource as Record<string, unknown>) || {}

  let netVal: unknown = undefined

  if (pLower.includes('hotmart')) {
    const commissionObj = (purchase.commission as Record<string, unknown>) || {}
    netVal = commissionObj.value ?? purchase.commission
  } else if (pLower.includes('cakto') || pLower.includes('cacto')) {
    netVal = payload.net_amount ?? data.net_amount ?? data.liquid_amount ?? payload.liquid_amount
  } else if (pLower.includes('getfy')) {
    const order = (payload.order as Record<string, unknown>) || {}
    netVal = payload.net_amount ?? payload.netAmount ?? payload.liquid_amount ?? order.net_amount
  } else if (pLower.includes('kiwify')) {
    const commissions = (payload.Commissions as Record<string, unknown>) || {}
    netVal = commissions.my_commission ?? payload.net_amount ?? payload.commission
    if (typeof netVal === 'number' && netVal > 500 && netVal % 1 === 0 && commissions.my_commission !== undefined) {
      netVal = netVal / 100
    }
  } else if (pLower.includes('yampi')) {
    netVal = resource.net_value ?? resource.liquid_value ?? payload.net_value
  } else if (pLower.includes('shopify')) {
    const refunded = parseFloat(String(payload.total_refunded_amount || '0'))
    if (!isNaN(refunded) && refunded > 0) {
      return Math.max(0, grossAmount - refunded)
    }
  } else {
    netVal = payload.netAmount ?? payload.net_amount ?? payload.liquid_amount
  }

  if (netVal !== undefined && netVal !== null) {
    const parsed = typeof netVal === 'number' ? netVal : parseFloat(String(netVal).replace(',', '.'))
    if (!isNaN(parsed) && parsed > 0) {
      return Math.round(parsed * 100) / 100
    }
  }

  // Fallback prioritário: valor bruto
  return grossAmount
}

/**
 * Normaliza status da venda para padrão unificado
 */
export function normalizeSaleStatus(
  rawStatus: string,
  _provider = 'generic'
): 'approved' | 'pending' | 'refunded' | 'chargeback' | 'cancelled' {
  if (!rawStatus) return 'pending'

  const s = rawStatus.toLowerCase().trim()

  if (
    s === 'purchase_approved' ||
    s === 'purchase_complete' ||
    s === 'orders/paid' ||
    s === 'payment_approved' ||
    s === 'approved' ||
    s === 'paid' ||
    s === 'completed' ||
    s === 'settled' ||
    s === 'pago' ||
    s === 'aprovado' ||
    s === 'switch_plan' ||
    s === 'pedido_pago' ||
    s === 'assinatura_criada' ||
    s === 'assinatura_renovada' ||
    s.includes('approved') ||
    s.includes('paid')
  ) {
    return 'approved'
  }

  if (
    s === 'purchase_refunded' ||
    s === 'refunds/create' ||
    s === 'refunded' ||
    s === 'reembolsado' ||
    s === 'estornado' ||
    s === 'devolvido' ||
    s === 'reembolso' ||
    s.includes('refund')
  ) {
    return 'refunded'
  }

  if (
    s === 'purchase_chargeback' ||
    s === 'purchase_protest' ||
    s === 'chargeback' ||
    s === 'chargedback' ||
    s === 'dispute' ||
    s === 'contestacao' ||
    s.includes('chargeback') ||
    s.includes('chargedback') ||
    s.includes('protest')
  ) {
    return 'chargeback'
  }

  if (
    s === 'purchase_canceled' ||
    s === 'purchase_expired' ||
    s === 'subscription_cancellation' ||
    s === 'orders/cancelled' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'recusado' ||
    s === 'falhado' ||
    s === 'failed' ||
    s === 'expired' ||
    s === 'pedido_cancelado' ||
    s === 'pagamento_recusado' ||
    s === 'assinatura_cancelada' ||
    s.includes('cancel') ||
    s.includes('refused') ||
    s.includes('expired')
  ) {
    return 'cancelled'
  }

  return 'pending'
}

/**
 * Normaliza método de pagamento (pix, card, boleto)
 */
export function normalizeSalePaymentMethod(payload: Record<string, unknown>, _provider = 'generic'): string {
  if (!payload) return 'card'

  const data = (payload.data as Record<string, unknown>) || {}
  const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
  const payment = (purchase.payment as Record<string, unknown>) || (payload.payment as Record<string, unknown>) || {}
  const resource = (payload.resource as Record<string, unknown>) || {}

  const rawType = String(
    payload.paymentMethod ||
    payment.method ||
    payment.type ||
    payload.payment_method ||
    payload.payment_type ||
    data.payment_method ||
    resource.payment_method ||
    payload.gateway ||
    (payload.payment_gateway_names as string[])?.[0] ||
    ''
  ).toLowerCase()

  if (rawType.includes('pix')) return 'pix'
  if (rawType.includes('boleto') || rawType.includes('billet') || rawType.includes('bank_slip')) return 'boleto'
  if (rawType.includes('card') || rawType.includes('cartao') || rawType.includes('credito') || rawType.includes('debito')) return 'card'

  return rawType || 'card'
}

/**
 * Normaliza número de parcelas da venda
 */
export function normalizeSaleInstallments(payload: Record<string, unknown>, _provider = 'generic'): number {
  if (!payload) return 1

  const data = (payload.data as Record<string, unknown>) || {}
  const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
  const payment = (purchase.payment as Record<string, unknown>) || (payload.payment as Record<string, unknown>) || {}
  const resource = (payload.resource as Record<string, unknown>) || {}
  const order = (payload.order as Record<string, unknown>) || (payload.Order as Record<string, unknown>) || {}

  const rawInstallments =
    payload.installments ??
    data.installments ??
    purchase.installments_number ??
    purchase.recurrence_number ??
    payment.installments_number ??
    payment.installments ??
    order.installments ??
    resource.installments ??
    payload.order_installments

  if (rawInstallments !== undefined && rawInstallments !== null) {
    const parsed = parseInt(String(rawInstallments), 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }

  return 1
}

/**
 * Extrai e normaliza parâmetros UTM de qualquer estrutura de payload
 */
export function normalizeSaleUtms(payload: Record<string, unknown>): {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  fbp?: string
  fbc?: string
  sessionId?: string
} {
  if (!payload) return {}

  const data = (payload.data as Record<string, unknown>) || {}
  const purchase = (data.purchase as Record<string, unknown>) || (payload.purchase as Record<string, unknown>) || {}
  const kiwifyTracking = (payload.TrackingParameters as Record<string, unknown>) || (payload.tracking_parameters as Record<string, unknown>) || {}
  const baseTracking = (purchase.tracking as Record<string, unknown>) || (payload.tracking as Record<string, unknown>) || (data.tracking as Record<string, unknown>) || (payload.utms as Record<string, unknown>) || (payload.utm as Record<string, unknown>) || (data.utms as Record<string, unknown>) || {}
  const tracking = { ...kiwifyTracking, ...baseTracking }
  const noteAttributes = (payload.note_attributes as Array<{ name: string; value: string }>) || []

  const getAttr = (name: string): string | undefined => {
    const attr = noteAttributes.find(a => a.name === name)
    return attr ? String(attr.value) : undefined
  }

  return {
    utmSource: String(tracking.utm_source || tracking.source || tracking.src || tracking.sck || payload.utm_source || payload.src || getAttr('utm_source') || '').trim() || undefined,
    utmMedium: String(tracking.utm_medium || tracking.medium || payload.utm_medium || getAttr('utm_medium') || '').trim() || undefined,
    utmCampaign: String(tracking.utm_campaign || tracking.campaign || payload.utm_campaign || getAttr('utm_campaign') || '').trim() || undefined,
    utmContent: String(tracking.utm_content || tracking.content || payload.utm_content || getAttr('utm_content') || '').trim() || undefined,
    utmTerm: String(tracking.utm_term || tracking.term || payload.utm_term || getAttr('utm_term') || '').trim() || undefined,
    fbclid: String(tracking.fbclid || payload.fbclid || getAttr('fbclid') || '').trim() || undefined,
    fbp: String(tracking.fbp || tracking._fbp || payload.fbp || payload._fbp || getAttr('_fbp') || '').trim() || undefined,
    fbc: String(tracking.fbc || tracking._fbc || payload.fbc || payload._fbc || getAttr('_fbc') || '').trim() || undefined,
    sessionId: String(tracking.sessionId || tracking._utmt_sid || payload.sessionId || payload._utmt_sid || '').trim() || undefined,
  }
}

export async function upsertSale(sale: InternalSale) {
  // Hidratar UTMs e identificadores a partir da TrackingSession correspondente daquela sessão
  if (sale.sessionId && (!sale.utmSource || !sale.utmCampaign)) {
    try {
      const session = await prisma.trackingSession.findUnique({
        where: { sessionId: sale.sessionId }
      })
      if (session) {
        sale.utmSource = sale.utmSource || session.utmSource || undefined
        sale.utmMedium = sale.utmMedium || session.utmMedium || undefined
        sale.utmCampaign = sale.utmCampaign || session.utmCampaign || undefined
        sale.utmContent = sale.utmContent || session.utmContent || undefined
        sale.utmTerm = sale.utmTerm || session.utmTerm || undefined
        sale.fbclid = sale.fbclid || session.fbclid || undefined
        sale.fbp = sale.fbp || session.fbp || undefined
        sale.fbc = sale.fbc || session.fbc || undefined
      }
    } catch (e) {
      console.error('[upsertSale] Error hydrating UTMs from TrackingSession:', e)
    }
  }

  const result = await prisma.sale.upsert({
    where: { 
      workspaceId_platform_externalId: { 
        workspaceId: sale.workspaceId, 
        platform: sale.platform, 
        externalId: sale.externalId 
      } 
    },
    create: {
      workspaceId: sale.workspaceId,
      platform: sale.platform,
      externalId: sale.externalId,
      externalRef: sale.externalRef || sale.paymentMethod,
      paymentMethod: sale.paymentMethod || sale.externalRef || 'card',
      installments: sale.installments || 1,
      status: sale.status,
      grossAmount: sale.grossAmount,
      netAmount: sale.netAmount,
      currency: sale.currency,
      customerEmail: sale.customerEmail,
      utmSource: sale.utmSource,
      utmMedium: sale.utmMedium,
      utmCampaign: sale.utmCampaign,
      utmContent: sale.utmContent,
      utmTerm: sale.utmTerm,
      fbclid: sale.fbclid,
      fbp: sale.fbp,
      fbc: sale.fbc,
      sessionId: sale.sessionId,
      orderedAt: sale.orderedAt || new Date(),
      approvedAt: sale.approvedAt,
      refundedAt: sale.refundedAt
    },
    update: { 
      status: sale.status, 
      paymentMethod: sale.paymentMethod || sale.externalRef || undefined,
      installments: sale.installments || undefined,
      grossAmount: sale.grossAmount,
      netAmount: sale.netAmount,
      currency: sale.currency,
      approvedAt: sale.approvedAt, 
      refundedAt: sale.refundedAt, 
      updatedAt: new Date(),
      utmSource: sale.utmSource,
      utmMedium: sale.utmMedium,
      utmCampaign: sale.utmCampaign,
      utmContent: sale.utmContent,
      utmTerm: sale.utmTerm,
      fbclid: sale.fbclid,
      fbp: sale.fbp,
      fbc: sale.fbc,
      sessionId: sale.sessionId
    }
  })

  // Upsert de Produto e SaleItem quando informados
  let resolvedProductId: string | undefined = undefined
  if (sale.productInfo?.name) {
    try {
      if (sale.productInfo.id) {
        const extProdId = String(sale.productInfo.id)
        let product = await prisma.product.findFirst({
          where: {
            workspaceId: sale.workspaceId,
            platform: sale.platform,
            externalId: extProdId
          }
        })

        if (!product) {
          product = await prisma.product.create({
            data: {
              workspaceId: sale.workspaceId,
              platform: sale.platform,
              externalId: extProdId,
              name: String(sale.productInfo.name),
              sku: sale.productInfo.sku,
              price: sale.grossAmount,
              currency: sale.currency
            }
          })
        } else {
          product = await prisma.product.update({
            where: { id: product.id },
            data: {
              name: String(sale.productInfo.name),
              sku: sale.productInfo.sku,
              price: sale.grossAmount,
              updatedAt: new Date()
            }
          })
        }
        resolvedProductId = product.id
      }

      const existingItem = await prisma.saleItem.findFirst({
        where: { saleId: result.id }
      })
      if (!existingItem) {
        await prisma.saleItem.create({
          data: {
            saleId: result.id,
            productId: resolvedProductId,
            externalProductId: sale.productInfo.id ? String(sale.productInfo.id) : undefined,
            name: String(sale.productInfo.name),
            sku: sale.productInfo.sku,
            quantity: 1,
            unitPrice: sale.grossAmount,
            totalPrice: sale.grossAmount
          }
        })
      }
    } catch (e) {
      console.error('[upsertSale] Error upserting product/saleItem:', e)
    }
  }
  
  // Try attribution
  try { 
    await attemptAttribution(result.id) 
  } catch (e) { 
    console.error('[upsertSale] Attribution error:', e) 
  }

  // Disparo automático para Meta Conversions API (CAPI) em vendas aprovadas
  let capiResult: { sent: boolean; success?: boolean; reason?: string; error?: string; pixelId?: string; result?: unknown; skipped?: boolean } | undefined = undefined
  if (result.status === 'approved') {
    try {
      capiResult = await dispatchPurchaseToCapi({
        workspaceId: result.workspaceId,
        saleId: result.id,
        externalId: result.externalId,
        grossAmount: result.grossAmount,
        currency: result.currency,
        customerEmail: result.customerEmail || undefined,
        customerPhone: sale.customerPhone,
        fbp: result.fbp || undefined,
        fbc: result.fbc || undefined,
        sessionId: result.sessionId || undefined,
        approvedAt: result.approvedAt || new Date(),
        productId: resolvedProductId || undefined,
        clientIp: sale.clientIp,
        clientUserAgent: sale.clientUserAgent,
        platform: result.platform
      })
      if (capiResult?.skipped) {
        console.log(`[upsertSale] CAPI Purchase skipped for sale ${result.id} (${capiResult.reason}).`)
      } else if (!capiResult?.sent || !capiResult?.success) {
        console.warn(`[upsertSale] CAPI Purchase not delivered immediately for sale ${result.id}: ${capiResult?.reason || capiResult?.error || 'delivery failed'}. Queued in TrackingEvent with status 'failed' for retry.`)
      }
    } catch (e) {
      console.error('[upsertSale] CAPI Purchase trigger error:', e)
      capiResult = { sent: false, success: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  
  return {
    ...result,
    capiResult
  }
}
