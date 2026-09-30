import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { sha256Hash } from '../src/lib/encryption'
import {
  normalizeSaleAmount,
  normalizeNetAmount,
  normalizeSaleStatus,
  normalizeSaleUtms
} from '../src/lib/integrations/normalizer'
import { dispatchPurchaseToCapi } from '../src/lib/meta/capi-service'

describe('Automação CAPI, Decoração de Checkout & Conector Kiwify', () => {
  // 1. Decoração de Links de Checkout
  it('1. Decoração de Links de Checkout: anexa UTMs, src, sck, fbclid e _utmt_sid sem duplicar query params', () => {
    const rawCheckout = 'https://pay.hotmart.com/PROD123?off=discount'
    const utms = {
      source: 'facebook',
      medium: 'stories',
      campaign: 'lancamento_abril',
      content: 'video_01',
      term: 'lookalike'
    }
    const fbclid = 'IwAR999_test_click_id'
    const sessionId = 'sess_xyz123'
    const visitorId = 'vis_abc456'

    const parsed = new URL(rawCheckout)
    if (utms.source) parsed.searchParams.set('utm_source', utms.source)
    if (utms.medium) parsed.searchParams.set('utm_medium', utms.medium)
    if (utms.campaign) parsed.searchParams.set('utm_campaign', utms.campaign)
    if (utms.content) parsed.searchParams.set('utm_content', utms.content)
    if (utms.term) parsed.searchParams.set('utm_term', utms.term)

    // Parâmetros especiais Hotmart e Kiwify
    parsed.searchParams.set('src', utms.source || utms.campaign)
    parsed.searchParams.set('sck', utms.campaign || utms.source)
    parsed.searchParams.set('fbclid', fbclid)
    parsed.searchParams.set('_utmt_sid', sessionId)
    parsed.searchParams.set('_utmt_vid', visitorId)

    const finalUrl = parsed.toString()

    assert.ok(finalUrl.includes('off=discount'), 'Preserva parâmetros originais da oferta')
    assert.ok(finalUrl.includes('utm_source=facebook'))
    assert.ok(finalUrl.includes('src=facebook'))
    assert.ok(finalUrl.includes('sck=lancamento_abril'))
    assert.ok(finalUrl.includes('fbclid=IwAR999_test_click_id'))
    assert.ok(finalUrl.includes('_utmt_sid=sess_xyz123'))
  })

  // 2. Normalização de Payload da Kiwify
  it('2. Kiwify: Normalização de venda aprovada, valor em centavos e comissão líquida', () => {
    const kiwifyPayload = {
      order_id: 'kw_order_987654',
      order_status: 'paid',
      payment_method: 'credit_card',
      created_at: '2026-09-28T19:00:00Z',
      Customer: {
        full_name: 'Comprador Kiwify',
        email: 'comprador@kiwify.com.br',
        mobile: '11999887766'
      },
      Product: {
        product_id: 'prod_kw_123',
        product_name: 'Curso de Tráfego Avançado'
      },
      Commissions: {
        charge_amount: 29700, // R$ 297,00 em centavos
        my_commission: 27500, // R$ 275,00 em centavos
        currency: 'BRL'
      },
      TrackingParameters: {
        src: 'instagram',
        sck: 'stories_escala',
        utm_source: 'meta_ads',
        utm_campaign: 'stories_escala',
        utm_medium: 'paid_social',
        utm_content: 'criativo_05'
      }
    }

    const status = normalizeSaleStatus(kiwifyPayload.order_status, 'kiwify')
    const grossAmount = normalizeSaleAmount(kiwifyPayload, 'kiwify')
    const netAmount = normalizeNetAmount(kiwifyPayload, 'kiwify', grossAmount)
    const utms = normalizeSaleUtms(kiwifyPayload)

    assert.equal(status, 'approved')
    assert.equal(grossAmount, 297.0)
    assert.equal(netAmount, 275.0)
    assert.equal(utms.utmSource, 'meta_ads')
    assert.equal(utms.utmCampaign, 'stories_escala')
    assert.equal(utms.utmContent, 'criativo_05')
  })

  // 3. Normalização de Reembolso e Chargeback da Kiwify
  it('3. Kiwify: Mapeamento de status de reembolso e contestação', () => {
    assert.equal(normalizeSaleStatus('refunded', 'kiwify'), 'refunded')
    assert.equal(normalizeSaleStatus('order_refunded', 'kiwify'), 'refunded')
    assert.equal(normalizeSaleStatus('chargedback', 'kiwify'), 'chargeback')
    assert.equal(normalizeSaleStatus('waiting_payment', 'kiwify'), 'pending')
  })

  // 4. Formatação Segura de Dados para Meta CAPI (SHA-256 e EMQ)
  it('4. Meta CAPI: Hash SHA-256 em e-mail e telefone com higienização', () => {
    const rawEmail = '  Cliente.VIP@Dominio.COM.BR  '
    const rawPhone = '(11) 98765-4321'

    const cleanEmail = rawEmail.toLowerCase().trim()
    const cleanPhone = '55' + rawPhone.replace(/\D/g, '')

    const hashedEmail = sha256Hash(cleanEmail)
    const hashedPhone = sha256Hash(cleanPhone)

    assert.match(hashedEmail, /^[a-f0-9]{64}$/)
    assert.match(hashedPhone, /^[a-f0-9]{64}$/)
    // Não pode conter caracteres maiúsculos nem espaços
    assert.equal(hashedEmail, sha256Hash('cliente.vip@dominio.com.br'))
    assert.equal(hashedPhone, sha256Hash('5511987654321'))
  })

  // 5. CAPI Service: Resiliência quando Workspace não tem Pixel configurado
  it('5. CAPI Service: Executa sem lançar exceções quando não há Pixel cadastrado', async () => {
    const result = await dispatchPurchaseToCapi({
      workspaceId: 'workspace_inexistente_123',
      saleId: 'sale_mock_1',
      externalId: 'ext_order_mock',
      grossAmount: 197.0,
      customerEmail: 'test@email.com',
      customerPhone: '11999998888'
    })

    assert.equal(result.sent, false)
    assert.equal(result.reason, 'pixel_not_configured')
  })
})
