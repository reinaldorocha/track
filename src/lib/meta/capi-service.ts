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
  clientIp?: string
  clientUserAgent?: string
  platform?: string
  eventId?: string
}

/**
 * Constrói identificador canônico e globalmente único para eventos de Purchase
 * com escopo por Workspace e Plataforma, garantindo paridade e deduplicação estrita com o tracker.js.
 */
export function buildPurchaseEventId(workspaceId: string, orderId: string, platform?: string): string {
  const cleanOrder = String(orderId || '').trim()
  const cleanWs = String(workspaceId || '').trim()
  const cleanPlat = String(platform || '').toLowerCase().trim()

  const parts = ['purchase']
  if (cleanWs) parts.push(cleanWs)
  if (cleanPlat) parts.push(cleanPlat)
  parts.push(cleanOrder)
  return parts.join('_')
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
  let resolvedEventId: string | undefined = undefined
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
      pixelId: directPixelId,
      clientIp,
      clientUserAgent,
      platform,
      eventId: directEventId
    } = params

    if (!workspaceId) return { sent: false, success: false, reason: 'missing_workspace_id' }

    // 0. Resolver ou herdar eventId canônico e globalmente único
    let eventId = directEventId
    if (!eventId) {
      // 0.1 Se o tracker.js já disparou o evento no navegador para esta venda/pedido, reutilizar o mesmo eventId
      const existingEvt = await prisma.trackingEvent.findFirst({
        where: {
          workspaceId,
          orderId: externalId || saleId,
          eventName: 'Purchase'
        },
        orderBy: { createdAt: 'desc' }
      })
      if (existingEvt?.eventId) {
        eventId = existingEvt.eventId
      } else {
        eventId = buildPurchaseEventId(workspaceId, externalId || saleId, platform)
      }
    }
    resolvedEventId = eventId

    // 0.2 Idempotência Estrita: Se já foi enviado com sucesso para a Meta CAPI anteriormente, NUNCA reenviar
    const existingStatus = await prisma.trackingEvent.findUnique({
      where: { eventId }
    })

    if (existingStatus?.status === 'sent') {
      console.log(`[CAPI Service] Idempotência: Purchase ${eventId} já foi transmitido anteriormente para a Meta com sucesso em ${existingStatus.sentAt}. Reenvio duplicado ignorado.`)
      return {
        sent: false,
        success: true,
        skipped: true,
        reason: 'already_sent',
        eventId,
        pixelId: existingStatus.pixelId || undefined
      }
    }

    // 0.3 Trava de Concorrência: se a compra já está 'sending' há menos de 30s, evitar disparo duplo simultâneo
    if (existingStatus?.status === 'sending' && existingStatus.updatedAt) {
      const ageSeconds = (Date.now() - new Date(existingStatus.updatedAt).getTime()) / 1000
      if (ageSeconds < 30) {
        console.log(`[CAPI Service] Idempotência: Purchase ${eventId} já está sendo transmitido em outra requisição simultânea. Disparo concorrente ignorado.`)
        return {
          sent: false,
          success: true,
          skipped: true,
          reason: 'in_flight',
          eventId
        }
      }
    }

    // 0. Pré-computar sessionData, userData e dados de matching para que QUALQUER falha preserve 100% dos dados
    let sessionData: { fbclid?: string | null; fbp?: string | null; fbc?: string | null; userAgent?: string | null; ipAddress?: string | null } | null = null
    if (sessionId) {
      sessionData = await prisma.trackingSession.findUnique({
        where: { sessionId },
        select: { fbclid: true, fbp: true, fbc: true, userAgent: true, ipAddress: true }
      })
    }

    const effectiveFbp = fbp || sessionData?.fbp || undefined
    const effectiveFbc = fbc || sessionData?.fbc || undefined
    const effectiveIp = clientIp || sessionData?.ipAddress || undefined
    const effectiveUserAgent = clientUserAgent || sessionData?.userAgent || undefined

    const userData: PixelEvent['user_data'] = {
      fbp: effectiveFbp,
      fbc: effectiveFbc,
      client_ip_address: effectiveIp,
      client_user_agent: effectiveUserAgent
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

    const eventValue = (grossAmount !== null && grossAmount !== undefined) ? Number(grossAmount) : 0

    // 0.4 Registrar que o evento está em processamento ('sending') antes de chamar a Meta (lock de concorrência)
    await prisma.trackingEvent.upsert({
      where: { eventId },
      update: {
        status: 'sending'
      },
      create: {
        eventId,
        workspaceId,
        sessionId: sessionId || null,
        eventName: 'Purchase',
        eventTime: approvedAt || new Date(),
        value: eventValue,
        currency: currency || 'BRL',
        orderId: externalId || saleId,
        status: 'sending',
        retryCount: 0,
        clientIp: effectiveIp || null,
        clientUserAgent: effectiveUserAgent || null,
        emailHash: userData.em?.[0] || null,
        phoneHash: userData.ph?.[0] || null,
        fbp: effectiveFbp || null,
        fbc: effectiveFbc || null,
        fbclid: sessionData?.fbclid || null
      }
    }).catch(err => console.error('[CAPI Service] Erro ao registrar status sending:', err))

    const recordFailedPurchaseEvent = async (errorMsg: string, pixelDbId?: string | null) => {
      await prisma.trackingEvent.upsert({
        where: { eventId },
        update: {
          pixelId: pixelDbId || undefined,
          status: 'failed',
          capiError: errorMsg,
          clientIp: effectiveIp || null,
          clientUserAgent: effectiveUserAgent || null,
          emailHash: userData.em?.[0] || null,
          phoneHash: userData.ph?.[0] || null,
          fbp: effectiveFbp || null,
          fbc: effectiveFbc || null,
          fbclid: sessionData?.fbclid || null
        },
        create: {
          eventId,
          workspaceId,
          pixelId: pixelDbId || null,
          sessionId: sessionId || null,
          eventName: 'Purchase',
          eventTime: approvedAt || new Date(),
          value: eventValue,
          currency: currency || 'BRL',
          orderId: externalId || saleId,
          status: 'failed',
          capiError: errorMsg,
          retryCount: 0,
          clientIp: effectiveIp || null,
          clientUserAgent: effectiveUserAgent || null,
          emailHash: userData.em?.[0] || null,
          phoneHash: userData.ph?.[0] || null,
          fbp: effectiveFbp || null,
          fbc: effectiveFbc || null,
          fbclid: sessionData?.fbclid || null
        }
      }).catch(err => console.error('[CAPI Service] Erro ao gravar TrackingEvent Purchase falho:', err))
    }

    // 1. Roteamento Inteligente do Pixel:
    const activePixels = await prisma.pixel.findMany({
      where: {
        workspaceId,
        status: 'active',
        accessTokenEnc: { not: null }
      }
    })

    if (activePixels.length === 0) {
      const errorMsg = 'No active pixel configured with access token in workspace'
      await recordFailedPurchaseEvent(errorMsg)
      return { sent: false, success: false, reason: 'pixel_not_configured', error: errorMsg, eventId }
    }

    let pixel: typeof activePixels[0] | null = null

    // 1.1 Se pixelId for fornecido diretamente
    if (directPixelId) {
      pixel = activePixels.find(p => p.id === directPixelId || p.pixelId === directPixelId) || null
    }

    // 1.2 Se temos productId, buscar o pixel explicitamente vinculado ao produto
    if (!pixel && productId) {
      const prod = await prisma.product.findFirst({
        where: { id: productId, workspaceId },
        select: { pixelId: true }
      })
      if (prod?.pixelId) {
        pixel = activePixels.find(p => p.id === prod.pixelId || p.pixelId === prod.pixelId) || null
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
      const targetPixelId = itemWithPixel?.product?.pixelId
      if (targetPixelId) {
        pixel = activePixels.find(p => p.id === targetPixelId || p.pixelId === targetPixelId) || null
      }
    }

    // 1.4 Resolução Segura de Fallback:
    if (!pixel) {
      if (activePixels.length === 1) {
        pixel = activePixels[0]
      } else {
        const errorMsg = `Multiple active pixels (${activePixels.length}) exist in workspace, but no pixel is mapped to product/sale (saleId: ${saleId || externalId}). Configure product-to-pixel mapping in settings.`
        console.error(`[CAPI Service] ${errorMsg}`)
        await recordFailedPurchaseEvent(errorMsg)
        return {
          sent: false,
          success: false,
          reason: 'ambiguous_pixel_configuration',
          error: errorMsg,
          eventId
        }
      }
    }

    if (!pixel || !pixel.accessTokenEnc) {
      const errorMsg = 'Selected pixel does not have an access token'
      await recordFailedPurchaseEvent(errorMsg, pixel?.id)
      return { sent: false, success: false, reason: 'pixel_not_configured', error: errorMsg, eventId }
    }

    let accessToken: string
    try {
      accessToken = decrypt(pixel.accessTokenEnc)
    } catch (e) {
      const errorMsg = 'Failed to decrypt pixel access token'
      console.error('[CAPI Service] Erro ao descriptografar access token do Pixel:', e)
      await recordFailedPurchaseEvent(errorMsg, pixel.id)
      return { sent: false, success: false, reason: 'decrypt_token_failed', error: errorMsg, eventId }
    }

    // 4. Montar evento de Purchase
    const eventTime = Math.floor((approvedAt || new Date()).getTime() / 1000)

    const purchaseEvent: PixelEvent = {
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        value: eventValue,
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

    // 6. Gravar log em TrackingEvent com TODOS os dados de matching preservados para retry
    await prisma.trackingEvent.upsert({
      where: { eventId },
      update: {
        pixelId: pixel.id,
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: isSuccess ? null : JSON.stringify(capiResult?.error || 'Nenhum evento aceito pela Meta'),
        sentAt: isSuccess ? new Date() : null,
        clientIp: effectiveIp || null,
        clientUserAgent: effectiveUserAgent || null,
        emailHash: userData.em?.[0] || null,
        phoneHash: userData.ph?.[0] || null,
        fbp: effectiveFbp || null,
        fbc: effectiveFbc || null,
        fbclid: sessionData?.fbclid || null
      },
      create: {
        eventId,
        workspaceId,
        pixelId: pixel.id,
        sessionId: sessionId || null,
        eventName: 'Purchase',
        eventTime: approvedAt || new Date(),
        value: eventValue,
        currency: currency || 'BRL',
        orderId: externalId || saleId,
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: isSuccess ? null : JSON.stringify(capiResult?.error || 'Nenhum evento aceito pela Meta'),
        sentAt: isSuccess ? new Date() : null,
        retryCount: 0,
        clientIp: effectiveIp || null,
        clientUserAgent: effectiveUserAgent || null,
        emailHash: userData.em?.[0] || null,
        phoneHash: userData.ph?.[0] || null,
        fbp: effectiveFbp || null,
        fbc: effectiveFbc || null,
        fbclid: sessionData?.fbclid || null
      }
    }).catch(err => console.error('[CAPI Service] Erro ao gravar TrackingEvent Purchase:', err))

    console.log(`[CAPI Service] Purchase processado para Meta (Pixel ${pixel.pixelId}, Order ${externalId || saleId}, Sucesso: ${isSuccess}):`, capiResult)
    return { sent: true, success: isSuccess, result: capiResult, pixelId: pixel.pixelId, eventId }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CAPI Service] Erro inesperado no dispatchPurchaseToCapi:', error)
    const fallbackEventId = resolvedEventId || (params?.workspaceId ? buildPurchaseEventId(params.workspaceId, params.externalId || params.saleId, params.platform) : undefined)
    if (params?.workspaceId && fallbackEventId) {
      await prisma.trackingEvent.upsert({
        where: { eventId: fallbackEventId },
        update: { status: 'failed', capiError: errorMsg },
        create: {
          eventId: fallbackEventId,
          workspaceId: params.workspaceId,
          eventName: 'Purchase',
          eventTime: params.approvedAt || new Date(),
          value: Number(params.grossAmount || 0),
          currency: params.currency || 'BRL',
          orderId: params.externalId || params.saleId,
          status: 'failed',
          capiError: errorMsg,
          retryCount: 0
        }
      }).catch(() => {})
    }
    return { sent: false, success: false, error: errorMsg, eventId: fallbackEventId }
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
      clientUserAgent,
      pixelId: directPixelId
    } = params

    if (!workspaceId) return { sent: false, success: false, reason: 'missing_workspace_id' }

    let sessionData: { fbclid?: string | null; fbp?: string | null; fbc?: string | null; userAgent?: string | null; ipAddress?: string | null } | null = null
    if (sessionId) {
      sessionData = await prisma.trackingSession.findUnique({
        where: { sessionId },
        select: { fbclid: true, fbp: true, fbc: true, userAgent: true, ipAddress: true }
      })
    }

    const effectiveIp = clientIp || sessionData?.ipAddress || undefined
    const effectiveUserAgent = clientUserAgent || sessionData?.userAgent || undefined
    const effectiveFbp = sessionData?.fbp || undefined
    const effectiveFbc = sessionData?.fbc || undefined

    const recordFailedNavEvent = async (errorMsg: string, pixelDbId?: string | null) => {
      await prisma.trackingEvent.updateMany({
        where: { eventId, workspaceId },
        data: {
          pixelId: pixelDbId || undefined,
          status: 'failed',
          capiError: errorMsg,
          clientIp: effectiveIp || null,
          clientUserAgent: effectiveUserAgent || null,
          fbp: effectiveFbp || null,
          fbc: effectiveFbc || null,
          fbclid: sessionData?.fbclid || null
        }
      }).catch(() => {})
    }

    // Roteamento de Pixel para Navegação:
    const activePixels = await prisma.pixel.findMany({
      where: {
        workspaceId,
        status: 'active',
        accessTokenEnc: { not: null }
      }
    })

    if (activePixels.length === 0) {
      const errorMsg = 'No active pixel configured with access token in workspace'
      await recordFailedNavEvent(errorMsg)
      return { sent: false, success: false, reason: 'pixel_not_configured', error: errorMsg }
    }

    let pixel: typeof activePixels[0] | null = null
    if (directPixelId) {
      pixel = activePixels.find(p => p.id === directPixelId || p.pixelId === directPixelId) || null
      if (!pixel) {
        const errorMsg = `Pixel ${directPixelId} is not active or not found in workspace`
        await recordFailedNavEvent(errorMsg)
        return {
          sent: false,
          success: false,
          reason: 'pixel_not_found',
          error: errorMsg
        }
      }
    } else {
      if (activePixels.length === 1) {
        pixel = activePixels[0]
      } else {
        const errorMsg = 'Multiple active pixels in workspace, but no pixel specified for navigation event (missing data-pixel-id)'
        await recordFailedNavEvent(errorMsg)
        return {
          sent: false,
          success: false,
          reason: 'ambiguous_pixel_configuration',
          error: errorMsg
        }
      }
    }

    if (!pixel || !pixel.accessTokenEnc) {
      const errorMsg = 'Selected pixel does not have an access token'
      await recordFailedNavEvent(errorMsg, pixel?.id)
      return { sent: false, success: false, reason: 'pixel_not_configured', error: errorMsg }
    }

    let accessToken: string
    try {
      accessToken = decrypt(pixel.accessTokenEnc)
    } catch {
      const errorMsg = 'Failed to decrypt pixel access token'
      await recordFailedNavEvent(errorMsg, pixel.id)
      return { sent: false, success: false, reason: 'decrypt_token_failed', error: errorMsg }
    }

    const userData: PixelEvent['user_data'] = {
      fbp: effectiveFbp,
      fbc: effectiveFbc,
      client_ip_address: effectiveIp,
      client_user_agent: effectiveUserAgent
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

    // Atualizar status no TrackingEvent com dados de matching para consistência
    await prisma.trackingEvent.updateMany({
      where: { eventId, workspaceId },
      data: {
        pixelId: pixel.id,
        status: isSuccess ? 'sent' : 'failed',
        capiResponse: JSON.stringify(capiResult),
        capiError: isSuccess ? null : JSON.stringify(capiResult?.error || 'Nenhum evento aceito pela Meta'),
        sentAt: isSuccess ? new Date() : null,
        clientIp: effectiveIp || null,
        clientUserAgent: effectiveUserAgent || null,
        fbp: userData.fbp || null,
        fbc: userData.fbc || null,
        fbclid: sessionData?.fbclid || null
      }
    }).catch(() => {})

    return { sent: true, success: isSuccess, result: capiResult, pixelId: pixel.pixelId }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CAPI Service] Erro no dispatchNavigationToCapi:', error)
    if (params?.eventId && params?.workspaceId) {
      await prisma.trackingEvent.updateMany({
        where: { eventId: params.eventId, workspaceId: params.workspaceId },
        data: { status: 'failed', capiError: errorMsg }
      }).catch(() => {})
    }
    return { sent: false, success: false, error: errorMsg }
  }
}

/**
 * Fila de Reprocessamento (Retry): busca eventos com status 'failed' e tenta reenviar à Meta CAPI
 * preservando 100% dos dados de matching EMQ (emailHash, phoneHash, fbp, fbc, fbclid, IP e User-Agent).
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
      include: { pixel: true, session: true },
      take: limit,
      orderBy: { createdAt: 'asc' }
    })

    let retried = 0
    let succeeded = 0

    for (const evt of failedEvents) {
      let pixel = evt.pixel
      // Se não havia pixel associado na falha anterior (ex: ambição de pixel), tentar resolver agora
      if (!pixel && evt.workspaceId) {
        if (evt.orderId) {
          const sale = await prisma.sale.findFirst({
            where: {
              workspaceId: evt.workspaceId,
              OR: [{ id: evt.orderId }, { externalId: evt.orderId }]
            },
            include: { items: { include: { product: true } } }
          })
          const itemWithPixel = sale?.items?.find(it => it.product?.pixelId)
          const targetPixelId = itemWithPixel?.product?.pixelId
          if (targetPixelId) {
            pixel = await prisma.pixel.findFirst({
              where: { id: targetPixelId, workspaceId: evt.workspaceId, status: 'active', accessTokenEnc: { not: null } }
            })
          }
        }
        if (!pixel) {
          const activePixels = await prisma.pixel.findMany({
            where: { workspaceId: evt.workspaceId, status: 'active', accessTokenEnc: { not: null } }
          })
          if (activePixels.length === 1) {
            pixel = activePixels[0]
          }
        }
      }

      if (!pixel || !pixel.accessTokenEnc) continue

      let accessToken: string
      try {
        accessToken = decrypt(pixel.accessTokenEnc)
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
          fbp: evt.fbp || evt.session?.fbp || undefined,
          fbc: evt.fbc || evt.session?.fbc || undefined,
          client_ip_address: evt.clientIp || evt.session?.ipAddress || undefined,
          client_user_agent: evt.clientUserAgent || evt.session?.userAgent || undefined
        },
        custom_data: {
          value: (evt.value !== null && evt.value !== undefined) ? evt.value : undefined,
          currency: evt.currency || undefined,
          order_id: evt.orderId || undefined
        }
      }

      const capiResult = await sendPixelEvents(
        pixel.pixelId,
        accessToken,
        [pixelEvent],
        pixel.testEventCode || undefined
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
            pixelId: pixel.id,
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
            pixelId: pixel.id,
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
