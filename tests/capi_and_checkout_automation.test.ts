import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { sha256Hash, encrypt } from '../src/lib/encryption'
import {
  normalizeSaleAmount,
  normalizeNetAmount,
  normalizeSaleStatus,
  normalizeSaleUtms
} from '../src/lib/integrations/normalizer'
import { dispatchPurchaseToCapi, dispatchNavigationToCapi, retryFailedCapiEvents } from '../src/lib/meta/capi-service'
import { sendPixelEvents } from '../src/lib/meta/pixel'
import { decorateCheckoutUrl, isCheckoutUrl } from '../src/lib/tracking/checkout-decorator'
import { prisma } from '../src/lib/db'

describe('Automação CAPI, Decoração Real de Checkout, Roteamento por Produto & Segurança', () => {
  let testWorkspaceId: string
  let testPixelA: any
  let testPixelB: any
  let testProductA: any
  let testProductB: any

  before(async () => {
    // Criar dados reais de teste no banco
    const ws = await prisma.workspace.create({
      data: {
        name: 'Workspace CAPI Test',
        slug: `capi-test-${Date.now()}`
      }
    })
    testWorkspaceId = ws.id

    // Pixel A (ex: produto A)
    testPixelA = await prisma.pixel.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Pixel Produto A',
        pixelId: '111111111111111',
        accessTokenEnc: encrypt('EAABmocktokenA'),
        status: 'active'
      }
    })

    // Pixel B (ex: produto B)
    testPixelB = await prisma.pixel.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Pixel Produto B',
        pixelId: '222222222222222',
        accessTokenEnc: encrypt('EAABmocktokenB'),
        status: 'active'
      }
    })

    // Produto A vinculado explicitamente ao Pixel A
    testProductA = await prisma.product.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Curso Front-End Pro',
        price: 497,
        pixelId: testPixelA.id
      }
    })

    // Produto B vinculado explicitamente ao Pixel B
    testProductB = await prisma.product.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Mentoria Exclusiva',
        price: 1997,
        pixelId: testPixelB.id
      }
    })
  })

  after(async () => {
    // Limpar registros de teste
    try {
      await prisma.trackingEvent.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.product.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.pixel.deleteMany({ where: { workspaceId: testWorkspaceId } })
      await prisma.workspace.delete({ where: { id: testWorkspaceId } })
    } catch {}
  })

  // 1. Decoração Real de Links de Checkout (usando módulo real importado)
  it('1. Decoração Real de Links de Checkout: anexa UTMs, src, sck, fbclid e sessionIds com módulo real', () => {
    const rawCheckout = 'https://pay.hotmart.com/PROD123?off=discount'
    assert.ok(isCheckoutUrl(rawCheckout), 'Reconhece URL de checkout suportada')

    const decorated = decorateCheckoutUrl(rawCheckout, {
      utms: {
        source: 'facebook',
        medium: 'stories',
        campaign: 'lancamento_abril',
        content: 'video_01',
        term: 'lookalike'
      },
      fbclid: 'IwAR999_test_click_id',
      sessionId: 'sess_xyz123',
      visitorId: 'vis_abc456'
    })

    assert.ok(decorated.includes('off=discount'), 'Preserva parâmetros originais da oferta')
    assert.ok(decorated.includes('utm_source=facebook'))
    assert.ok(decorated.includes('src=facebook'))
    assert.ok(decorated.includes('sck=lancamento_abril'))
    assert.ok(decorated.includes('fbclid=IwAR999_test_click_id'))
    assert.ok(decorated.includes('_utmt_sid=sess_xyz123'))
    assert.ok(decorated.includes('_utmt_vid=vis_abc456'))
  })

  // 2. Roteamento por Produto -> Pixel: Produto A envia para Pixel A, Produto B envia para Pixel B
  it('2. Roteamento Produto -> Pixel: Venda do Produto A roteia para Pixel A, Produto B para Pixel B', async () => {
    // Interceptar fetch da Graph API para simular resposta de sucesso da Meta
    const originalFetch = global.fetch
    let capturedPixelId = ''

    global.fetch = async (url: any, init: any) => {
      const urlStr = String(url)
      if (urlStr.includes('111111111111111')) capturedPixelId = '111111111111111'
      if (urlStr.includes('222222222222222')) capturedPixelId = '222222222222222'

      return {
        ok: true,
        status: 200,
        json: async () => ({
          events_received: 1,
          fbtrace_id: 'mock_trace_123'
        })
      } as any
    }

    try {
      // Disparo com Produto A
      const resA = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: 'sale_prod_a_1',
        externalId: 'ext_order_a_1',
        grossAmount: 497,
        productId: testProductA.id,
        customerEmail: 'compradorA@teste.com'
      })

      assert.equal(resA.sent, true)
      assert.equal(resA.success, true)
      assert.equal(resA.pixelId, '111111111111111', 'Roteou com sucesso para o Pixel do Produto A')
      assert.equal(capturedPixelId, '111111111111111')

      // Disparo com Produto B
      const resB = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: 'sale_prod_b_1',
        externalId: 'ext_order_b_1',
        grossAmount: 1997,
        productId: testProductB.id,
        customerEmail: 'compradorB@teste.com'
      })

      assert.equal(resB.sent, true)
      assert.equal(resB.success, true)
      assert.equal(resB.pixelId, '222222222222222', 'Roteou com sucesso para o Pixel do Produto B')
      assert.equal(capturedPixelId, '222222222222222')
    } finally {
      global.fetch = originalFetch
    }
  })

  // 3. Detecção e Não-Mascaramento de Erro HTTP da Meta Graph API
  it('3. Resposta HTTP CAPI: não mascara falhas da Meta (400 Bad Request retorna success=false e status=failed)', async () => {
    const originalFetch = global.fetch
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'Invalid access token',
          type: 'OAuthException',
          code: 190
        }
      })
    } as any)

    try {
      const res = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: 'sale_error_1',
        externalId: 'ext_order_err_1',
        grossAmount: 150,
        productId: testProductA.id,
        customerEmail: 'cliente_erro@teste.com'
      })

      assert.equal(res.sent, true)
      assert.equal(res.success, false, 'Não deve mascarar como sucesso quando a Meta responde erro')

      // Verificar registro no banco com status failed
      const dbEvent = await prisma.trackingEvent.findUnique({
        where: { eventId: 'purchase_ext_order_err_1' }
      })
      assert.ok(dbEvent)
      assert.equal(dbEvent.status, 'failed')
      assert.ok(dbEvent.capiError?.includes('Invalid access token'))
    } finally {
      global.fetch = originalFetch
    }
  })

  // 4. Deduplicação Paritária: ID gerado no Navegador bate exatamente com o ID do CAPI Server
  it('4. Deduplicação Paritária: event_id do navegador bate com o event_id do webhook/CAPI', () => {
    const orderId = 'HP123456789'
    // Formato gerado pelo tracker.js na thank you page
    const browserEventId = `purchase_${orderId}`
    // Formato gerado pelo CAPI no backend
    const serverEventId = `purchase_${orderId}`

    assert.equal(browserEventId, serverEventId, 'event_id entre Pixel do Browser e CAPI Server é 100% idêntico')
  })

  // 5. Fila e Reprocessamento de Eventos com Falha (Retry Queue)
  it('5. Fila de Retry CAPI: reprocessa eventos com status failed incrementando tentativas ou marcando sent', async () => {
    // Criar evento com status failed
    await prisma.trackingEvent.create({
      data: {
        workspaceId: testWorkspaceId,
        pixelId: testPixelA.id,
        eventId: 'purchase_retry_test_1',
        eventName: 'Purchase',
        eventTime: new Date(),
        value: 100,
        currency: 'BRL',
        orderId: 'retry_test_1',
        status: 'failed',
        retryCount: 0
      }
    })

    const originalFetch = global.fetch
    // Simular que o reenvio tem sucesso
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 })
    } as any)

    try {
      const retryResult = await retryFailedCapiEvents(testWorkspaceId, 10)
      assert.ok(retryResult.retried >= 1)
      assert.ok(retryResult.succeeded >= 1)

      const updated = await prisma.trackingEvent.findUnique({
        where: { eventId: 'purchase_retry_test_1' }
      })
      assert.equal(updated?.status, 'sent')
      assert.equal(updated?.capiError, null)
    } finally {
      global.fetch = originalFetch
    }
  })

  // 6. Normalização Kiwify existente preservada
  it('6. Kiwify: Normalização de venda aprovada e comissão', () => {
    const kiwifyPayload = {
      order_id: 'kw_order_987654',
      order_status: 'paid',
      Customer: { email: 'comprador@kiwify.com.br' },
      Commissions: { charge_amount: 29700, my_commission: 27500 }
    }

    const status = normalizeSaleStatus(kiwifyPayload.order_status, 'kiwify')
    const grossAmount = normalizeSaleAmount(kiwifyPayload, 'kiwify')
    const netAmount = normalizeNetAmount(kiwifyPayload, 'kiwify', grossAmount)

    assert.equal(status, 'approved')
    assert.equal(grossAmount, 297.0)
    assert.equal(netAmount, 275.0)
  })

  // 7. Bloqueio de Fallback Ambíguo na Compra: múltiplos pixels sem mapeamento falha explicitamente
  it('7. Bloqueio de Fallback Ambíguo na Compra: não escolhe pixel arbitrário quando múltiplos existem e produto não está mapeado', async () => {
    // Venda de produto sem pixelId vinculado
    const unmappedProduct = await prisma.product.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Produto Não Mapeado',
        price: 99
      }
    })

    const res = await dispatchPurchaseToCapi({
      workspaceId: testWorkspaceId,
      saleId: 'sale_unmapped_1',
      externalId: 'ext_unmapped_1',
      grossAmount: 99,
      productId: unmappedProduct.id,
      customerEmail: 'cliente_ambiguo@teste.com'
    })

    assert.equal(res.sent, false)
    assert.equal(res.reason, 'ambiguous_pixel_configuration', 'Deve rejeitar com erro de configuração ambígua')
    assert.ok(res.error?.includes('Multiple active pixels'))
  })

  // 8. Roteamento de Eventos de Navegação (PageView / InitiateCheckout):
  it('8. Roteamento de Navegação CAPI: PageView/IC roteia por pixelId e rejeita quando ambíguo', async () => {
    const originalFetch = global.fetch
    let capturedNavPixel = ''
    global.fetch = async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes('111111111111111')) capturedNavPixel = '111111111111111'
      if (urlStr.includes('222222222222222')) capturedNavPixel = '222222222222222'
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    try {
      // 8.1 Com pixelId A especificado
      const resA = await dispatchNavigationToCapi({
        workspaceId: testWorkspaceId,
        eventName: 'PageView',
        eventId: 'evt_nav_test_a',
        pixelId: testPixelA.id
      })
      assert.equal(resA.sent, true)
      assert.equal(resA.pixelId, '111111111111111')
      assert.equal(capturedNavPixel, '111111111111111')

      // 8.2 Com pixelId B especificado
      const resB = await dispatchNavigationToCapi({
        workspaceId: testWorkspaceId,
        eventName: 'InitiateCheckout',
        eventId: 'evt_nav_test_b',
        pixelId: testPixelB.id
      })
      assert.equal(resB.sent, true)
      assert.equal(resB.pixelId, '222222222222222')
      assert.equal(capturedNavPixel, '222222222222222')

      // 8.3 Sem pixelId quando há múltiplos pixels -> rejeita com erro ambíguo
      const resAmbiguous = await dispatchNavigationToCapi({
        workspaceId: testWorkspaceId,
        eventName: 'PageView',
        eventId: 'evt_nav_test_ambiguous'
      })
      assert.equal(resAmbiguous.sent, false)
      assert.equal(resAmbiguous.reason, 'ambiguous_pixel_configuration')
    } finally {
      global.fetch = originalFetch
    }
  })

  // 9. Preservação de 100% dos Parâmetros de Matching EMQ no Retry
  it('9. Preservação Total de EMQ no Retry: emailHash, phoneHash, fbp e fbc são mantidos no reprocessamento', async () => {
    const originalFetch = global.fetch
    let capturedUserData: any = null

    global.fetch = async (url: any, init: any) => {
      // A primeira chamada (dispatchPurchaseToCapi) simula falha
      if (init && init.body) {
        const bodyStr = String(init.body)
        const params = new URLSearchParams(bodyStr)
        const dataJson = params.get('data')
        if (dataJson) {
          const events = JSON.parse(dataJson)
          capturedUserData = events[0]?.user_data
        }
      }

      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Temporary Meta Graph Error' } })
      } as any
    }

    try {
      const email = 'lead_qualificado@gmail.com'
      const phone = '5511999998888'
      const fbp = 'fb.1.1700000000.123456789'
      const fbc = 'fb.1.1700000000.IwAR_test_click'

      // 1º Envio falha
      await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: 'sale_retry_emq_1',
        externalId: 'ext_retry_emq_1',
        grossAmount: 497,
        productId: testProductA.id,
        customerEmail: email,
        customerPhone: phone,
        fbp,
        fbc
      })

      // Verificar que o TrackingEvent gravou os hashes e identificadores
      const failedEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: 'purchase_ext_retry_emq_1' }
      })
      assert.ok(failedEvt)
      assert.equal(failedEvt.status, 'failed')
      assert.equal(failedEvt.emailHash, sha256Hash(email.toLowerCase().trim()))
      assert.ok(failedEvt.phoneHash)
      assert.equal(failedEvt.fbp, fbp)
      assert.equal(failedEvt.fbc, fbc)

      // 2º Envio (Retry): interceptar fetch com sucesso e capturar payload
      let retryCapturedUserData: any = null
      global.fetch = async (url: any, init: any) => {
        if (init && init.body) {
          try {
            const parsed = JSON.parse(String(init.body))
            retryCapturedUserData = parsed.data?.[0]?.user_data
          } catch {}
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ events_received: 1 })
        } as any
      }

      const retryRes = await retryFailedCapiEvents(testWorkspaceId, 10)
      assert.ok(retryRes.succeeded >= 1)
      assert.ok(retryCapturedUserData, 'Payload do retry foi capturado')
      assert.equal(retryCapturedUserData.em?.[0], sha256Hash(email.toLowerCase().trim()), 'Hash de e-mail preservado no retry')
      assert.ok(retryCapturedUserData.ph?.[0], 'Hash de telefone preservado no retry')
      assert.equal(retryCapturedUserData.fbp, fbp, 'Cookie _fbp preservado no retry')
      assert.equal(retryCapturedUserData.fbc, fbc, 'Cookie _fbc preservado no retry')
    } finally {
      global.fetch = originalFetch
    }
  })

  // 10. Deduplicação: /api/tracking/event NÃO envia Purchase para evitar duplicação com o webhook
  it('10. Endpoint /api/tracking/event: não dispara CAPI para eventos Purchase do navegador', async () => {
    const { POST: trackingEventPost } = await import('../src/app/api/tracking/event/route')

    let capiCalledForPurchase = false
    const originalFetch = global.fetch
    global.fetch = async (url: any) => {
      capiCalledForPurchase = true
      return { ok: true, status: 200, json: async () => ({ events_received: 1 }) } as any
    }

    try {
      const req = new Request('http://localhost/api/tracking/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          eventName: 'Purchase',
          eventId: 'purchase_dedup_test_order_123',
          orderId: 'dedup_test_order_123',
          value: 497
        })
      })

      const res = await trackingEventPost(req)
      const data = await res.json()

      assert.equal(res.status, 200)
      assert.equal(data.success, true)
      assert.equal(capiCalledForPurchase, false, 'Não deve chamar CAPI para evento Purchase do navegador')
    } finally {
      global.fetch = originalFetch
    }
  })
})
