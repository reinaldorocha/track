export interface CheckoutDecorationParams {
  utms?: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
  fbclid?: string
  fbp?: string
  fbc?: string
  sessionId?: string
  visitorId?: string
}

export const DEFAULT_CHECKOUT_DOMAINS = [
  'hotmart.com', 'cakto.com.br', 'cacto.com.br', 'yampi.io', 'yampi.com.br',
  'shopify.com', 'myshopify.com', 'kiwify.com.br', 'eduzz.com', 'braip.com',
  'ticto.com.br', 'monetizze.com.br', 'perfectpay.com.br', 'kirvano.com',
  'cartpanda.com', 'greenn.com.br', 'doppler.com.br', 'appmax.com.br',
  'getfy.com', 'getfy.com.br', 'getfy.cloud',
  'profjonathanrocha.com.br',
  'pay.', 'checkout', 'seguro.', 'pagamento.', '/c/'
]

export function isCheckoutUrl(urlStr: string, customDomains: string[] = []): boolean {
  if (!urlStr) return false
  const lower = urlStr.toLowerCase()
  const domains = [...DEFAULT_CHECKOUT_DOMAINS, ...customDomains]
  return domains.some(domain => lower.includes(domain))
}

export function decorateCheckoutUrl(urlStr: string, params: CheckoutDecorationParams, baseUrl = 'https://meusite.com'): string {
  if (!urlStr || urlStr.startsWith('javascript:') || urlStr.startsWith('#')) return urlStr
  try {
    const parsed = new URL(urlStr, baseUrl)
    const { utms = {}, fbclid, fbp, fbc, sessionId, visitorId } = params

    // Preservar UTMs padrões caso o link ainda não possua
    if (utms.source && !parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', utms.source)
    if (utms.medium && !parsed.searchParams.has('utm_medium')) parsed.searchParams.set('utm_medium', utms.medium)
    if (utms.campaign && !parsed.searchParams.has('utm_campaign')) parsed.searchParams.set('utm_campaign', utms.campaign)
    if (utms.content && !parsed.searchParams.has('utm_content')) parsed.searchParams.set('utm_content', utms.content)
    if (utms.term && !parsed.searchParams.has('utm_term')) parsed.searchParams.set('utm_term', utms.term)

    // Parâmetros especiais Hotmart, Kiwify, Cakto, Eduzz
    const srcVal = utms.source || utms.campaign
    const sckVal = utms.campaign || utms.source
    if (srcVal && !parsed.searchParams.has('src')) parsed.searchParams.set('src', srcVal)
    if (sckVal && !parsed.searchParams.has('sck')) parsed.searchParams.set('sck', sckVal)

    // Identificadores Meta Ads
    if (fbclid && !parsed.searchParams.has('fbclid')) parsed.searchParams.set('fbclid', fbclid)
    if (fbp && !parsed.searchParams.has('fbp')) parsed.searchParams.set('fbp', fbp)
    if (fbc && !parsed.searchParams.has('fbc')) parsed.searchParams.set('fbc', fbc)

    // Identificador de Sessão do UTM-Track para correlação direta
    if (sessionId && !parsed.searchParams.has('_utmt_sid')) parsed.searchParams.set('_utmt_sid', sessionId)
    if (visitorId && !parsed.searchParams.has('_utmt_vid')) parsed.searchParams.set('_utmt_vid', visitorId)

    return parsed.toString()
  } catch {
    return urlStr
  }
}
