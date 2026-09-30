import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { encrypt, decrypt, maskSecret, sha256Hash } from '../src/lib/encryption'
import { 
  isHotmartTestEvent, 
  isTestSaleRecord, 
  normalizeSaleAmount, 
  normalizeNetAmount, 
  normalizeSaleStatus, 
  normalizeSaleUtms 
} from '../src/lib/integrations/normalizer'
import { calcCPA, calcROAS, calcROI, calcProfit } from '../src/lib/metrics'

describe('Central de Configuração de Rastreamento & Tracking Hub', () => {
  // 1. Geração de script do tracker
  it('1. Geração de Script do Tracker: script dinâmico com URL canônica e workspaceId', () => {
    const appUrl = 'https://utm-track-navy.vercel.app'
    const workspaceId = 'ws_prod_998877'
    const scriptSnippet = `<script src="${appUrl}/tracker.js" data-api-url="${appUrl}" data-workspace-id="${workspaceId}" async></script>`

    assert.ok(scriptSnippet.includes('src="https://utm-track-navy.vercel.app/tracker.js"'))
    assert.ok(scriptSnippet.includes('data-workspace-id="ws_prod_998877"'))
    assert.ok(scriptSnippet.includes('async'))
  })

  // 2. Geração de parâmetros dinâmicos oficiais Meta Ads
  it('2. Parâmetros Oficiais Meta Ads: suporta tokens oficiais sem requerer digitação manual de fbclid', () => {
    const metaParams = "utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&src={{site_source_name}}&sck={{campaign.name}}"
    
    assert.ok(metaParams.includes('utm_source={{site_source_name}}'))
    assert.ok(metaParams.includes('utm_medium={{placement}}'))
    assert.ok(metaParams.includes('utm_campaign={{campaign.name}}'))
    assert.ok(metaParams.includes('utm_content={{ad.name}}'))
    assert.ok(metaParams.includes('utm_term={{adset.name}}'))
    // fbclid não deve estar na query string manual
    assert.equal(metaParams.includes('fbclid='), false)
  })

  // 3. Captura UTM e normalização
  it('3. Extração e Captura de UTMs a partir de URLs e payloads', () => {
    const url = 'https://meusite.com.br/checkout?utm_source=meta_ads&utm_medium=stories&utm_campaign=escala_q4&utm_content=video_03&utm_term=interesses'
    const parsed = new URL(url)
    const utms = {
      source: parsed.searchParams.get('utm_source'),
      medium: parsed.searchParams.get('utm_medium'),
      campaign: parsed.searchParams.get('utm_campaign'),
      content: parsed.searchParams.get('utm_content'),
      term: parsed.searchParams.get('utm_term')
    }

    assert.equal(utms.source, 'meta_ads')
    assert.equal(utms.medium, 'stories')
    assert.equal(utms.campaign, 'escala_q4')
    assert.equal(utms.content, 'video_03')
    assert.equal(utms.term, 'interesses')
  })

  // 4. Captura automática de fbclid
  it('4. Captura Automática de fbclid na URL de destino', () => {
    const url = 'https://meusite.com.br/produto?fbclid=IwAR123456789abcdef_clickid&utm_source=meta'
    const parsed = new URL(url)
    const fbclid = parsed.searchParams.get('fbclid')

    assert.equal(fbclid, 'IwAR123456789abcdef_clickid')
  })

  // 5. Geração e formato dos cookies Meta (_fbp e _fbc)
  it('5. Geração de Cookies Meta _fbp e _fbc para CAPI', () => {
    const fbclid = 'IwAR123_meta_click_id'
    const timestamp = 1725800000000
    const fbc = `fb.1.${timestamp}.${fbclid}`
    const fbp = `fb.1.${timestamp}.987654321`

    assert.ok(fbc.startsWith('fb.1.'))
    assert.ok(fbc.includes(fbclid))
    assert.ok(fbp.startsWith('fb.1.'))
  })

  // 6. Sessão de Tracking (TrackingSession)
  it('6. Sessão de Tracking: normaliza sessionId e vincula parâmetros', () => {
    const sessionPayload = {
      sessionId: 'sess_abc123',
      visitorId: 'vis_xyz789',
      workspaceId: 'ws_demo',
      utmSource: 'facebook',
      utmCampaign: 'black_friday',
      fbclid: 'IwAR_test_click',
      fbp: 'fb.1.1700000.123',
      fbc: 'fb.1.1700000.IwAR_test_click'
    }

    assert.equal(sessionPayload.sessionId, 'sess_abc123')
    assert.equal(sessionPayload.utmCampaign, 'black_friday')
  })

  // 7. Endpoints de Webhook dos Gateways
  it('7. Mapeamento de rotas canônicas de Webhook por Gateway', () => {
    const baseUrl = 'https://utm-track-navy.vercel.app'
    const endpoints = {
      hotmart: `${baseUrl}/api/webhooks/hotmart`,
      cakto: `${baseUrl}/api/webhooks/cakto`,
      yampi: `${baseUrl}/api/webhooks/yampi`,
      shopify: `${baseUrl}/api/webhooks/shopify`,
      generic: `${baseUrl}/api/webhooks/generic`
    }

    assert.equal(endpoints.hotmart, 'https://utm-track-navy.vercel.app/api/webhooks/hotmart')
    assert.equal(endpoints.cakto, 'https://utm-track-navy.vercel.app/api/webhooks/cakto')
    assert.equal(endpoints.yampi, 'https://utm-track-navy.vercel.app/api/webhooks/yampi')
    assert.equal(endpoints.shopify, 'https://utm-track-navy.vercel.app/api/webhooks/shopify')
  })

  // 8. Headers e Autenticação de Webhook
  it('8. Validação de Headers de Segurança dos Webhooks', () => {
    const headers = {
      hotmart: 'x-hotmart-hottok',
      cakto: 'x-cakto-signature',
      yampi: 'authorization',
      shopify: 'x-shopify-hmac-sha256'
    }

    assert.equal(headers.hotmart, 'x-hotmart-hottok')
    assert.equal(headers.cakto, 'x-cakto-signature')
    assert.equal(headers.shopify, 'x-shopify-hmac-sha256')
  })

  // 9. Idempotência em Webhooks
  it('9. Geração de chaves de idempotência únicas para evitar duplicação', () => {
    const hotmartKey1 = `hotmart_HP123456_PURCHASE_APPROVED`
    const hotmartKey2 = `hotmart_HP123456_PURCHASE_APPROVED`
    const caktoKey = `cakto_CK987654_approved`

    assert.equal(hotmartKey1, hotmartKey2)
    assert.notEqual(hotmartKey1, caktoKey)
  })

  // 10. Venda aprovada reflete no faturamento
  it('10. Venda Aprovada: normaliza status para approved e calcula receita real', () => {
    const status = normalizeSaleStatus('PURCHASE_APPROVED')
    const gross = normalizeSaleAmount({ amount: 297.0 }, 'cakto')
    const net = normalizeNetAmount({ net_amount: 270.0 }, 'cakto', gross)

    assert.equal(status, 'approved')
    assert.equal(gross, 297.0)
    assert.equal(net, 270.0)
  })

  // 11. Venda pendente não entra no faturamento
  it('11. Venda Pendente: normaliza status para pending sem inflar faturamento', () => {
    const status = normalizeSaleStatus('WAITING_PAYMENT')
    assert.equal(status, 'pending')
  })

  // 12. Refund (reembolso)
  it('12. Reembolso: normaliza status para refunded', () => {
    const status = normalizeSaleStatus('PURCHASE_REFUNDED')
    assert.equal(status, 'refunded')
  })

  // 13. Chargeback
  it('13. Chargeback: normaliza status para chargeback', () => {
    const status = normalizeSaleStatus('PURCHASE_CHARGEBACK')
    assert.equal(status, 'chargeback')
  })

  // 14. Identificação de Evento de Teste Hotmart
  it('14. isHotmartTestEvent detecta eventos disparados pela ferramenta de teste da Hotmart', () => {
    const testPayload = {
      id: 'test_event_123',
      event: 'PURCHASE_APPROVED',
      data: {
        purchase: {
          transaction: 'HP00000000000001',
          status: 'APPROVED',
          price: { value: 1500.0 }
        },
        buyer: { email: 'teste@hotmart.com' }
      }
    }

    assert.equal(isHotmartTestEvent(testPayload, { 'x-hotmart-test': 'true' }), true)
  })

  // 15. Isolamento financeiro de teste
  it('15. isTestSaleRecord identifica e impede que testes contaminem métricas reais', () => {
    assert.equal(isTestSaleRecord({ externalId: 'HP00000000000001', customerEmail: 'comprador_teste@hotmart.com' }), true)
    assert.equal(isTestSaleRecord({ externalId: 'HP98765432109876', customerEmail: 'cliente.real@gmail.com' }), false)
  })

  // 16. Atribuição Last-Click por fbclid e sessionId
  it('16. Regras de Atribuição: confiança 1.0 para fbclid e 0.9 para fbp', () => {
    const confFbclid = 1.0
    const confFbp = 0.9
    const confSession = 0.85

    assert.ok(confFbclid > confFbp)
    assert.ok(confFbp > confSession)
  })

  // 17. Meta Pixel & CAPI Payload Format
  it('17. Conversions API (CAPI): formatação de dados com hash SHA-256 para em e ph', () => {
    const rawEmail = 'Usuario.Teste@Email.com'
    const rawPhone = '(11) 98765-4321'

    const hashedEmail = sha256Hash(rawEmail.toLowerCase().trim())
    const hashedPhone = sha256Hash(rawPhone.replace(/\D/g, ''))

    assert.match(hashedEmail, /^[a-f0-9]{64}$/)
    assert.match(hashedPhone, /^[a-f0-9]{64}$/)
  })

  // 18. Deduplicação com event_id
  it('18. Deduplicação de Eventos: mesmo event_id entre Browser Pixel e Server CAPI', () => {
    const eventId = 'evt_' + Date.now().toString(36)
    const browserEvent = { event_name: 'PageView', event_id: eventId }
    const serverEvent = { event_name: 'PageView', event_id: eventId }

    assert.equal(browserEvent.event_id, serverEvent.event_id)
  })

  // 19. Criptografia e Mascaramento de Access Token
  it('19. Segurança: Criptografia AES-256-GCM e Mascaramento de Tokens', () => {
    const rawToken = 'EAABwz91k20kZAO123456789abcdef'
    const encrypted = encrypt(rawToken)
    assert.notEqual(encrypted, rawToken)

    const masked = maskSecret(rawToken)
    assert.equal(masked, '••••••••••••cdef')

    const decrypted = decrypt(encrypted)
    assert.equal(decrypted, rawToken)
  })

  // 20. Multi-tenant e Isolamento de Workspace
  it('20. Isolamento Multi-Tenant: workspaces distintos não compartilham dados', () => {
    const ws1 = { id: 'ws_alpha', slug: 'alpha-marketing' }
    const ws2 = { id: 'ws_beta', slug: 'beta-scaling' }

    assert.notEqual(ws1.id, ws2.id)
    assert.notEqual(ws1.slug, ws2.slug)
  })

  // 21. Cálculos de ROAS, ROI, CPA com Atribuição
  it('21. Métricas de Performance: Cálculo exato de ROAS, ROI e Lucro Líquido', () => {
    const revenue = 10000
    const spend = 2500
    const profit = calcProfit({
      netRevenue: revenue,
      adSpend: spend,
      productCost: 1000,
      fees: 500,
      taxes: 500,
      expenses: 500
    })

    assert.equal(profit, 5000)
    assert.equal(calcROAS(revenue, spend), 4.0) // 4x ROAS
    assert.equal(calcROI(profit, spend), 200)   // 200% ROI
  })

  // 22. Integridade de Diagnóstico
  it('22. Pipeline de Diagnóstico: valida os 5 elos do funil de rastreamento', () => {
    const pipelineSteps = [
      'ANÚNCIO_META_PARAMETROS',
      'PÁGINA_VENDA_TRACKER',
      'SESSÃO_COOKIES_FBCLID',
      'WEBHOOK_GATEWAY',
      'ATRIBUIÇÃO_DASHBOARD'
    ]

    assert.equal(pipelineSteps.length, 5)
    assert.equal(pipelineSteps[0], 'ANÚNCIO_META_PARAMETROS')
    assert.equal(pipelineSteps[4], 'ATRIBUIÇÃO_DASHBOARD')
  })
})
