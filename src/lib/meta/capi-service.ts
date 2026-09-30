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
  productId?: string
  pixelId?: string
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
  pixelId?: string
}

/**
 * Dispara automaticamente evento de Purchase para a Meta Conversions API (CAPI)
 * com roteamento por produto -> pixel, hash SHA-256 e deduplicação via event_id.
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
      approvedAt,
      productId,
      pixelId: directPixelId
    } = params

    if (!workspaceId) return { sent: false, reason: 'missing_workspace_id' }

    // 1. Roteamento Inteligente do Pixel:
    // 1.1 Se pixelId for fornecido diretamente
    let pixel = null
    if (directPixelId) {
      pixel = await prisma.pixel.findFirst({
        where: { id: directPixelId, workspaceId, status: 'active', accessTokenEnc: { not: null } }
      })
    }

    // 1.2 Se temos productId, buscar o pixel explicitamente vinculado ao produto
    if (!pixel && productId) {
      const prod = await prisma.product.findFirst({
        where: { id: productId, workspaceId },
        select: { pixelId: true }
      })
      if (prod?.pixelId) {
        pixel = await prisma.pixel.findFirst({
          where: { id: prod.pixelId, workspaceId, status: 'active', accessTokenEnc: { not: null } }
        })
      }
    }

    // 1.3 Se não encontrou, verificar se a venda tem items com produto vinculado a um pixel
    if (!pixel && (saleId || externalId)) {
      const saleWithItem = await prisma.sale.findFirst({
        where: {
          workspaceId,
          OR: [{ id: saleId }, { externalId: externalId }]
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      })

      const itemWithPixel = saleWithItem?.items?.find(it => it.product?.pixelId)
      if (itemWithPixel?.product?.pixelId) {
        pixel = await prisma.pixel.findFirst({
          where: { id: itemWithPixel.product.pixelId, workspaceId, status: 'active', accessTokenEnc: { not: null } }
        })
      }
    }

    // 1.4 Fallback para o Pixel padrão ativo do Workspace
    if (!pixel) {
      pixel = await prisma.pixel.findFirst({
        where: {
          workspaceId,
          status: 'active',
          accessTokenEnc: { not: null }
        }
      })
    }

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

    const isSuccess = Boolean(
      capiResult &&
      capiResult.ok !== false &&
      !capiResult.error &&
      (typeof capiResult.events_received === 'number' ? capiResult.events_received > 0 : true)
    )

    // 6. Gravar log em TrackingEvent para auditoria no painel e resiliência
    await prisma.trackingEvent.upsert({
      where: { eventId },
      update: {
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: isSuccess ? null : JSON.stringify(capiResult?.error || 'Nenhum evento aceito pela Meta'),
        sentAt: isSuccess ? new Date() : null,
      },
      create: {
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
        capiError: isSuccess ? null : JSON.stringify(capiResult?.error || 'Nenhum evento aceito pela Meta'),
        sentAt: isSuccess ? new Date() : null,
        retryCount: 0
      }
    }).catch(err => console.error('[CAPI Service] Erro ao gravar TrackingEvent Purchase:', err))

    console.log(`[CAPI Service] Purchase processado para Meta (Pixel ${pixel.pixelId}, Order ${externalId || saleId}, Sucesso: ${isSuccess}):`, capiResult)
    return { sent: true, success: isSuccess, result: capiResult, pixelId: pixel.pixelId }
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

    // Se pixelId foi fornecido diretamente
    let pixel = null
    if (params.pixelId) {
      pixel = await prisma.pixel.findFirst({
        where: { id: params.pixelId, workspaceId, status: 'active', accessTokenEnc: { not: null } }
      })
    }

    if (!pixel) {
      pixel = await prisma.pixel.findFirst({
        where: {
          workspaceId,
          status: 'active',
          accessTokenEnc: { not: null }
        }
      })
    }

    if (!pixel || !pixel.accessTokenEnc) {
      return { sent: false, reason: 'pixel_not_configured' }
    }

    let accessToken: string
    try {
      accessToken = decrypt(pixel.accessTokenEnc)
    } catch {
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

    const isSuccess = Boolean(
      capiResult &&
      capiResult.ok !== false &&
      !capiResult.error &&
      (typeof capiResult.events_received === 'number' ? capiResult.events_received > 0 : true)
    )

    // Atualizar status no TrackingEvent
    await prisma.trackingEvent.updateMany({
      where: { eventId, workspaceId },
      data: {
        pixelId: pixel.id,
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: isSuccess ? null : JSON.stringify(capiResult?.error || 'Nenhum evento aceito pela Meta'),
        sentAt: isSuccess ? new Date() : null
      }
    }).catch(() => {})

    return { sent: true, success: isSuccess, result: capiResult, pixelId: pixel.pixelId }
  } catch (error) {
    console.error('[CAPI Service] Erro no dispatchNavigationToCapi:', error)
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Fila de Reprocessamento (Retry): busca eventos com status 'failed' e tenta reenviar à Meta CAPI
 */
export async function retryFailedCapiEvents(workspaceId?: string, limit = 20) {
  try {
    const whereClause: {
      status: string
      retryCount: { lt: number }
      workspaceId?: string
    } = {
      status: 'failed',
      retryCount: { lt: 5 }
    }
    if (workspaceId) whereClause.workspaceId = workspaceId

    const failedEvents = await prisma.trackingEvent.findMany({
      where: whereClause,
      include: { pixel: true },
      take: limit,
      orderBy: { createdAt: 'asc' }
    })

    let retried = 0
    let succeeded = 0

    for (const evt of failedEvents) {
      if (!evt.pixel || !evt.pixel.accessTokenEnc) continue

      let accessToken: string
      try {
        accessToken = decrypt(evt.pixel.accessTokenEnc)
      } catch {
        continue
      }

      retried++
      const eventTime = Math.floor(new Date(evt.eventTime).getTime() / 1000)
      const pixelEvent: PixelEvent = {
        event_name: evt.eventName,
        event_time: eventTime,
        event_id: evt.eventId,
        event_source_url: evt.sourceUrl || undefined,
        action_source: 'website',
        user_data: {
          em: evt.emailHash ? [evt.emailHash] : undefined,
          ph: evt.phoneHash ? [evt.phoneHash] : undefined,
          fbp: evt.fbp || undefined,
          fbc: evt.fbc || undefined,
        },
        custom_data: {
          value: evt.value || undefined,
          currency: evt.currency || undefined,
          order_id: evt.orderId || undefined
        }
      }

      const capiResult = await sendPixelEvents(
        evt.pixel.pixelId,
        accessToken,
        [pixelEvent],
        evt.pixel.testEventCode || undefined
      )

      const isSuccess = Boolean(
        capiResult &&
        capiResult.ok !== false &&
        !capiResult.error &&
        (typeof capiResult.events_received === 'number' ? capiResult.events_received > 0 : true)
      )

      if (isSuccess) {
        succeeded++
        await prisma.trackingEvent.update({
          where: { id: evt.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            capiResponse: JSON.stringify(capiResult),
            capiError: null
          }
        })
      } else {
        await prisma.trackingEvent.update({
          where: { id: evt.id },
          data: {
            retryCount: { increment: 1 },
            capiResponse: JSON.stringify(capiResult),
            capiError: JSON.stringify(capiResult?.error || 'Retry falhou')
          }
        })
      }
    }

    return { total: failedEvents.length, retried, succeeded }
  } catch (error) {
    console.error('[CAPI Service] Erro no retryFailedCapiEvents:', error)
    return { total: 0, retried: 0, succeeded: 0, error: String(error) }
  }
}
