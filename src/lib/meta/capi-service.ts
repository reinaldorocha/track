import { prisma } from '@/lib/db'
import { sendPixelEvents, PixelEvent } from '@/lib/meta/pixel'
import { decrypt, sha256Hash } from '@/lib/encryption'

export interface DispatchPurchaseParams {
  workspaceId: string
  saleId: string
  externalId: string
  grossAmount: number
  currency?: string
  customerEmail?: string
  customerPhone?: string
  fbp?: string
  fbc?: string
  sessionId?: string
  approvedAt?: Date
}

export interface DispatchNavigationParams {
  workspaceId: string
  sessionId?: string
  eventName: string
  eventId: string
  sourceUrl?: string
  value?: number
  currency?: string
  contentIds?: string
  clientIp?: string
  clientUserAgent?: string
}

/**
 * Dispara automaticamente evento de Purchase para a Meta Conversions API (CAPI)
 * com hash seguro SHA-256 de dados do comprador e deduplicação via event_id.
 */
export async function dispatchPurchaseToCapi(params: DispatchPurchaseParams) {
  try {
    const {
      workspaceId,
      saleId,
      externalId,
      grossAmount,
      currency = 'BRL',
      customerEmail,
      customerPhone,
      fbp,
      fbc,
      sessionId,
      approvedAt
    } = params

    if (!workspaceId) return { sent: false, reason: 'missing_workspace_id' }

    // 1. Localizar Pixel ativo configurado para este Workspace
    const pixel = await prisma.pixel.findFirst({
      where: {
        workspaceId,
        status: 'active',
        accessTokenEnc: { not: null }
      }
    })

    if (!pixel || !pixel.accessTokenEnc) {
      return { sent: false, reason: 'pixel_not_configured' }
    }

    let accessToken: string
    try {
      accessToken = decrypt(pixel.accessTokenEnc)
    } catch (e) {
      console.error('[CAPI Service] Erro ao descriptografar access token do Pixel:', e)
      return { sent: false, reason: 'decrypt_token_failed' }
    }

    // 2. Buscar dados complementares da sessão de navegação se disponível
    let sessionData: { fbp?: string | null; fbc?: string | null; userAgent?: string | null; ipAddress?: string | null } | null = null
    if (sessionId) {
      sessionData = await prisma.trackingSession.findUnique({
        where: { sessionId },
        select: { fbp: true, fbc: true, userAgent: true, ipAddress: true }
      })
    }

    const effectiveFbp = fbp || sessionData?.fbp || undefined
    const effectiveFbc = fbc || sessionData?.fbc || undefined

    // 3. Montar dados do usuário com hash SHA-256 obrigatório da Meta
    const userData: PixelEvent['user_data'] = {
      fbp: effectiveFbp,
      fbc: effectiveFbc,
      client_ip_address: sessionData?.ipAddress || undefined,
      client_user_agent: sessionData?.userAgent || undefined
    }

    if (customerEmail && customerEmail.trim()) {
      userData.em = [sha256Hash(customerEmail.toLowerCase().trim())]
    }

    if (customerPhone && customerPhone.trim()) {
      const cleanPhone = customerPhone.replace(/\D/g, '')
      if (cleanPhone.length >= 8) {
        // Se não tiver DDI 55 (Brasil) e tiver 10 ou 11 dígitos, adiciona
        const formattedPhone = (cleanPhone.length === 10 || cleanPhone.length === 11) ? `55${cleanPhone}` : cleanPhone
        userData.ph = [sha256Hash(formattedPhone)]
      }
    }

    // 4. Montar evento de Purchase
    const eventTime = Math.floor((approvedAt || new Date()).getTime() / 1000)
    const eventId = `purchase_${externalId || saleId}`

    const purchaseEvent: PixelEvent = {
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        value: Number(grossAmount || 0),
        currency: currency || 'BRL',
        order_id: externalId || saleId,
        content_type: 'product'
      }
    }

    // 5. Enviar para a Meta Graph API v21.0
    const capiResult = await sendPixelEvents(
      pixel.pixelId,
      accessToken,
      [purchaseEvent],
      pixel.testEventCode || undefined
    )

    const isSuccess = Boolean(capiResult && (capiResult.events_received !== undefined || !capiResult.error))

    // 6. Gravar log em TrackingEvent para auditoria no painel
    await prisma.trackingEvent.create({
      data: {
        eventId,
        workspaceId,
        pixelId: pixel.id,
        sessionId: sessionId || null,
        eventName: 'Purchase',
        eventTime: approvedAt || new Date(),
        value: Number(grossAmount || 0),
        currency: currency || 'BRL',
        orderId: externalId || saleId,
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: capiResult?.error ? JSON.stringify(capiResult.error) : null,
        sentAt: new Date()
      }
    }).catch(err => console.error('[CAPI Service] Erro ao gravar TrackingEvent Purchase:', err))

    console.log(`[CAPI Service] Purchase enviado com sucesso para Meta (Pixel ${pixel.pixelId}, Order ${externalId}):`, capiResult)
    return { sent: true, success: isSuccess, result: capiResult }
  } catch (error) {
    console.error('[CAPI Service] Erro inesperado no dispatchPurchaseToCapi:', error)
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Dispara automaticamente eventos de navegação (PageView, InitiateCheckout) para a Meta CAPI
 */
export async function dispatchNavigationToCapi(params: DispatchNavigationParams) {
  try {
    const {
      workspaceId,
      sessionId,
      eventName,
      eventId,
      sourceUrl,
      value,
      currency,
      contentIds,
      clientIp,
      clientUserAgent
    } = params

    if (!workspaceId) return { sent: false, reason: 'missing_workspace_id' }

    const pixel = await prisma.pixel.findFirst({
      where: {
        workspaceId,
        status: 'active',
        accessTokenEnc: { not: null }
      }
    })

    if (!pixel || !pixel.accessTokenEnc) {
      return { sent: false, reason: 'pixel_not_configured' }
    }

    let accessToken: string
    try {
      accessToken = decrypt(pixel.accessTokenEnc)
    } catch (e) {
      return { sent: false, reason: 'decrypt_token_failed' }
    }

    let sessionData: { fbp?: string | null; fbc?: string | null; userAgent?: string | null; ipAddress?: string | null } | null = null
    if (sessionId) {
      sessionData = await prisma.trackingSession.findUnique({
        where: { sessionId },
        select: { fbp: true, fbc: true, userAgent: true, ipAddress: true }
      })
    }

    const userData: PixelEvent['user_data'] = {
      fbp: sessionData?.fbp || undefined,
      fbc: sessionData?.fbc || undefined,
      client_ip_address: clientIp || sessionData?.ipAddress || undefined,
      client_user_agent: clientUserAgent || sessionData?.userAgent || undefined
    }

    const customData: PixelEvent['custom_data'] = {}
    if (value !== undefined && value !== null) customData.value = Number(value)
    if (currency) customData.currency = currency
    if (contentIds) {
      try {
        const parsed = JSON.parse(contentIds)
        if (Array.isArray(parsed)) customData.content_ids = parsed.map(String)
      } catch {
        customData.content_ids = [contentIds]
      }
    }

    const navEvent: PixelEvent = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: sourceUrl || undefined,
      action_source: 'website',
      user_data: userData,
      custom_data: Object.keys(customData).length > 0 ? customData : undefined
    }

    const capiResult = await sendPixelEvents(
      pixel.pixelId,
      accessToken,
      [navEvent],
      pixel.testEventCode || undefined
    )

    const isSuccess = Boolean(capiResult && (capiResult.events_received !== undefined || !capiResult.error))

    // Atualizar status no TrackingEvent
    await prisma.trackingEvent.updateMany({
      where: { eventId, workspaceId },
      data: {
        pixelId: pixel.id,
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: capiResult?.error ? JSON.stringify(capiResult.error) : null,
        sentAt: new Date()
      }
    }).catch(() => {})

    return { sent: true, success: isSuccess, result: capiResult }
  } catch (error) {
    console.error('[CAPI Service] Erro no dispatchNavigationToCapi:', error)
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
