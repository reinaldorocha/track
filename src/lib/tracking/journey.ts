import { prisma } from '@/lib/db'

export type TouchpointType =
  | 'ad_click'
  | 'session_start'
  | 'page_view'
  | 'lead'
  | 'initiate_checkout'
  | 'pix_generated'
  | 'purchase_approved'
  | 'refund'
  | 'chargeback'

export interface Touchpoint {
  id: string
  timestamp: string
  type: TouchpointType
  title: string
  description?: string
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  url?: string
  device?: string
  referrer?: string
  isConversion?: boolean
  metadata?: Record<string, unknown>
}

export interface JourneyData {
  saleId: string
  visitorId?: string | null
  sessionId?: string | null
  touchpoints: Touchpoint[]
  summary: {
    firstTouch?: {
      timestamp: string
      source: string
      campaign?: string
      type: string
    } | null
    lastTouch?: {
      timestamp: string
      source: string
      campaign?: string
      type: string
    } | null
    totalTouchpoints: number
    timeToConvertFormatted: string
    timeToConvertSeconds: number
    pathPreview: string[]
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

/**
 * Constrói a jornada cronológica multi-touch do comprador associada a uma venda.
 */
export async function getCustomerJourneyForSale(
  saleId: string,
  workspaceId: string
): Promise<JourneyData | null> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, workspaceId },
  })

  if (!sale) return null

  // 1. Localizar sessão primária vinculada à venda
  let primarySession = null
  if (sale.sessionId) {
    primarySession = await prisma.trackingSession.findUnique({
      where: { sessionId: sale.sessionId },
    })
  } else if (sale.fbclid) {
    primarySession = await prisma.trackingSession.findFirst({
      where: { workspaceId, fbclid: sale.fbclid },
      orderBy: { createdAt: 'desc' },
    })
  } else if (sale.fbp) {
    primarySession = await prisma.trackingSession.findFirst({
      where: { workspaceId, fbp: sale.fbp },
      orderBy: { createdAt: 'desc' },
    })
  }

  const visitorId = primarySession?.visitorId || null

  // 2. Coletar todas as sessões relacionadas ao comprador (via visitorId ou sessão primária)
  let sessions: any[] = []
  if (visitorId) {
    sessions = await prisma.trackingSession.findMany({
      where: { workspaceId, visitorId },
      orderBy: { firstSeenAt: 'asc' },
    })
  } else if (primarySession) {
    sessions = [primarySession]
  }

  const sessionIds = sessions.map((s) => s.sessionId)

  // 3. Coletar eventos de funil
  let trackingEvents: any[] = []
  if (sessionIds.length > 0) {
    trackingEvents = await prisma.trackingEvent.findMany({
      where: {
        workspaceId,
        sessionId: { in: sessionIds },
      },
      orderBy: { eventTime: 'asc' },
    })
  }

  // 4. Montar a timeline de pontos de contato
  const touchpoints: Touchpoint[] = []

  // Sessões e Ad Clicks
  for (const s of sessions) {
    const isAd = Boolean(s.fbclid || s.utmCampaign || s.utmSource)
    touchpoints.push({
      id: `sess_${s.id}`,
      timestamp: (s.firstSeenAt || s.createdAt).toISOString(),
      type: isAd ? 'ad_click' : 'session_start',
      title: isAd ? 'Clique em Anúncio / Tráfego' : 'Início de Sessão',
      description: s.landingPage ? `Entrada em: ${s.landingPage}` : 'Acesso ao site',
      source: s.utmSource || (s.fbclid ? 'Meta Ads (fbclid)' : 'Direto'),
      medium: s.utmMedium || undefined,
      campaign: s.utmCampaign || undefined,
      content: s.utmContent || undefined,
      term: s.utmTerm || undefined,
      url: s.landingPage || undefined,
      device: s.userAgent?.toLowerCase().includes('mobile') ? 'Mobile' : 'Desktop',
      referrer: s.referrer || undefined,
    })
  }

  // Eventos de rastreamento do funil
  for (const ev of trackingEvents) {
    let type: TouchpointType = 'page_view'
    let title = 'Visualização de Página'

    if (ev.eventName === 'Lead') {
      type = 'lead'
      title = 'Lead Capturado / Inscrição'
    } else if (ev.eventName === 'InitiateCheckout' || ev.eventName === 'AddToCart') {
      type = 'initiate_checkout'
      title = 'Início de Checkout'
    } else if (ev.eventName === 'Purchase') {
      continue // Venda tratada abaixo via registro oficial da Sale
    }

    touchpoints.push({
      id: `evt_${ev.id}`,
      timestamp: ev.eventTime.toISOString(),
      type,
      title,
      description: ev.sourceUrl || undefined,
      url: ev.sourceUrl || undefined,
    })
  }

  // Evento do Pedido Criado / Pix Gerado
  touchpoints.push({
    id: `sale_order_${sale.id}`,
    timestamp: sale.orderedAt.toISOString(),
    type: sale.status === 'pending' ? 'pix_generated' : 'initiate_checkout',
    title: sale.status === 'pending' ? 'Pix Gerado / Aguardando Pagamento' : 'Pedido Realizado no Checkout',
    description: `Checkout ${sale.platform.toUpperCase()} - ${sale.externalId}`,
    source: sale.utmSource || undefined,
    campaign: sale.utmCampaign || undefined,
    isConversion: sale.status === 'pending',
  })

  // Evento de Pagamento Aprovado
  if (sale.status === 'approved' && sale.approvedAt) {
    touchpoints.push({
      id: `sale_approved_${sale.id}`,
      timestamp: sale.approvedAt.toISOString(),
      type: 'purchase_approved',
      title: 'Compra Confirmada / Pagamento Aprovado',
      description: `Valor Bruto: R$ ${sale.grossAmount.toFixed(2)} (${sale.paymentMethod || 'Aprovado'})`,
      source: sale.utmSource || undefined,
      campaign: sale.utmCampaign || undefined,
      isConversion: true,
    })
  }

  // Evento de Reembolso
  if (sale.status === 'refunded' && sale.refundedAt) {
    touchpoints.push({
      id: `sale_refunded_${sale.id}`,
      timestamp: sale.refundedAt.toISOString(),
      type: 'refund',
      title: 'Venda Reembolsada / Estorno Realizado',
      description: `Valor Estornado: R$ ${sale.grossAmount.toFixed(2)}`,
    })
  }

  // Evento de Chargeback
  if (sale.status === 'chargeback') {
    touchpoints.push({
      id: `sale_chargeback_${sale.id}`,
      timestamp: (sale.refundedAt || sale.orderedAt).toISOString(),
      type: 'chargeback',
      title: 'Contestação / Chargeback Recebido',
      description: `Contestação no gateway de pagamento`,
    })
  }

  // Ordenar cronologicamente
  touchpoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Calcular métricas
  const firstTouchpoint = touchpoints[0]
  const conversionTouchpoint = touchpoints.find((t) => t.isConversion) || touchpoints[touchpoints.length - 1]

  const firstTime = new Date(firstTouchpoint.timestamp).getTime()
  const convTime = new Date(conversionTouchpoint.timestamp).getTime()
  const timeToConvertSeconds = Math.max(0, Math.round((convTime - firstTime) / 1000))

  const pathPreview: string[] = []
  if (firstTouchpoint.campaign || firstTouchpoint.source) {
    pathPreview.push(firstTouchpoint.campaign || firstTouchpoint.source || 'Anúncio')
  } else {
    pathPreview.push('Acesso Direto')
  }

  if (touchpoints.some((t) => t.type === 'page_view' || t.type === 'session_start')) {
    pathPreview.push('Landing Page')
  }
  if (touchpoints.some((t) => t.type === 'lead')) {
    pathPreview.push('Lead')
  }
  pathPreview.push(`Checkout ${sale.platform.toUpperCase()}`)
  if (sale.status === 'approved') {
    pathPreview.push('Venda Aprovada')
  } else if (sale.status === 'pending') {
    pathPreview.push('Pix Pendente')
  }

  return {
    saleId: sale.id,
    visitorId,
    sessionId: sale.sessionId || primarySession?.sessionId || null,
    touchpoints,
    summary: {
      firstTouch: firstTouchpoint
        ? {
            timestamp: firstTouchpoint.timestamp,
            source: firstTouchpoint.source || 'Direto',
            campaign: firstTouchpoint.campaign,
            type: firstTouchpoint.type,
          }
        : null,
      lastTouch: {
        timestamp: sale.orderedAt.toISOString(),
        source: sale.utmSource || firstTouchpoint?.source || 'Direto',
        campaign: sale.utmCampaign || firstTouchpoint?.campaign,
        type: 'checkout',
      },
      totalTouchpoints: touchpoints.length,
      timeToConvertFormatted: formatDuration(timeToConvertSeconds),
      timeToConvertSeconds,
      pathPreview,
    },
  }
}
