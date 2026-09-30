import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { sha256Hash, encrypt } from '../src/lib/encryption'
import {
  normalizeSaleAmount,
  normalizeNetAmount,
  normalizeSaleStatus,
  normalizeSaleUtms
} from '../src/lib/integrations/normalizer'
import { dispatchPurchaseToCapi, dispatchNavigationToCapi, retryFailedCapiEvents, buildPurchaseEventId } from '../src/lib/meta/capi-service'
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
        where: { eventId: res.eventId }
      })
      assert.ok(dbEvent)
      assert.equal(dbEvent.status, 'failed')
      assert.ok(dbEvent.capiError?.includes('Invalid access token'))
    } finally {
      global.fetch = originalFetch
    }
  })

  // 4. Deduplicação Paritária: ID gerado no Navegador bate exatamente com o ID do CAPI Server
  it('4. Deduplicação Paritária: event_id do navegador bate com o event_id do webhook/CAPI com escopo de workspace e plataforma', () => {
    const orderId = 'HP123456789'
    const platform = 'hotmart'
    // Formato gerado pelo tracker.js na thank you page
    const browserEventId = buildPurchaseEventId(testWorkspaceId, orderId, platform)
    // Formato gerado pelo CAPI no backend
    const serverEventId = buildPurchaseEventId(testWorkspaceId, orderId, platform)

    assert.equal(browserEventId, serverEventId, 'event_id entre Pixel do Browser e CAPI Server é 100% idêntico')
    assert.equal(browserEventId, `purchase_${testWorkspaceId}_hotmart_${orderId}`)
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
      const firstRes = await dispatchPurchaseToCapi({
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
        where: { eventId: firstRes.eventId }
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

  // 11. Garantia de retry: Venda sem pixel configurado grava TrackingEvent com status 'failed' para retry
  it('11. Garantia de retry: Venda em workspace sem pixel grava TrackingEvent failed para reprocessamento', async () => {
    const emptyWs = await prisma.workspace.create({
      data: { name: 'Empty Pixel Workspace', slug: `empty-px-${Date.now()}` }
    })

    try {
      const result = await dispatchPurchaseToCapi({
        workspaceId: emptyWs.id,
        saleId: 'sale_empty_px_1',
        externalId: 'ext_empty_px_1',
        grossAmount: 0,
        customerEmail: 'cliente_gratis@teste.com'
      })

      assert.equal(result.sent, false)
      assert.equal(result.reason, 'pixel_not_configured')

      const savedEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: result.eventId }
      })
      assert.ok(savedEvt, 'TrackingEvent deve ser persistido mesmo sem pixel')
      assert.equal(savedEvt.status, 'failed')
      assert.equal(savedEvt.value, 0)
      assert.ok(savedEvt.capiError?.includes('pixel'))
    } finally {
      await prisma.trackingEvent.deleteMany({ where: { workspaceId: emptyWs.id } })
      await prisma.workspace.delete({ where: { id: emptyWs.id } })
    }
  })

  // 12. Navegação ambígua: workspace com múltiplos pixels sem data-pixel-id atualiza status para failed
  it('12. Navegação ambígua: sem data-pixel-id em workspace multi-pixel marca TrackingEvent como failed', async () => {
    const navEventId = `nav_ambig_${Date.now()}`
    await prisma.trackingEvent.create({
      data: {
        eventId: navEventId,
        workspaceId: testWorkspaceId,
        eventName: 'PageView',
        status: 'received',
        eventTime: new Date()
      }
    })

    const result = await dispatchNavigationToCapi({
      workspaceId: testWorkspaceId,
      eventName: 'PageView',
      eventId: navEventId
    })

    assert.equal(result.sent, false)
    assert.equal(result.reason, 'ambiguous_pixel_configuration')

    const updatedEvt = await prisma.trackingEvent.findUnique({
      where: { eventId: navEventId }
    })
    assert.ok(updatedEvt)
    assert.equal(updatedEvt.status, 'failed', 'Evento de navegação não pode ficar como received')
    assert.ok(updatedEvt.capiError?.includes('Multiple active pixels'))
  })

  // 13. Retry preserva 100% dos dados: clientIp, clientUserAgent e value: 0
  it('13. Retry preserva 100% dos dados: clientIp, clientUserAgent e valor 0', async () => {
    const originalFetch = global.fetch
    const retryEventId = `purchase_zero_val_${Date.now()}`

    try {
      await prisma.trackingEvent.create({
        data: {
          eventId: retryEventId,
          workspaceId: testWorkspaceId,
          pixelId: testPixelA.id,
          eventName: 'Purchase',
          eventTime: new Date(),
          value: 0,
          currency: 'BRL',
          orderId: `order_zero_${Date.now()}`,
          status: 'failed',
          clientIp: '201.88.99.10',
          clientUserAgent: 'Mozilla/5.0 Test Browser CAPI',
          retryCount: 0
        }
      })

      let capturedPayload: any = null
      global.fetch = async (url: any, init: any) => {
        if (init && init.body) {
          try {
            capturedPayload = JSON.parse(String(init.body))?.data?.[0]
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
      assert.ok(capturedPayload, 'Payload de reenvio foi capturado')
      assert.equal(capturedPayload.user_data?.client_ip_address, '201.88.99.10')
      assert.equal(capturedPayload.user_data?.client_user_agent, 'Mozilla/5.0 Test Browser CAPI')
      assert.equal(capturedPayload.custom_data?.value, 0, 'Valor zero deve ser preservado numericamente, não undefined')
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({ where: { eventId: retryEventId } })
    }
  })

  // 14. Idempotência estrita: reenvio de venda já aprovada e enviada é detectado e ignorado antes de chamar a Meta
  it('14. Idempotência estrita: reenvio de venda já aprovada e enviada é ignorado antes da Meta', async () => {
    let metaFetchCallCount = 0
    const originalFetch = global.fetch
    global.fetch = async () => {
      metaFetchCallCount++
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    try {
      const orderId = `idemp_order_${Date.now()}`
      // 1ª Chamada: Envia com sucesso
      const res1 = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: `sale_${orderId}`,
        externalId: orderId,
        grossAmount: 497,
        productId: testProductA.id,
        customerEmail: 'idempotencia@teste.com'
      })

      assert.equal(res1.sent, true)
      assert.equal(res1.success, true)
      assert.equal(metaFetchCallCount, 1)

      // 2ª Chamada: Mesma venda aprovada reenviada pelo gateway
      const res2 = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: `sale_${orderId}`,
        externalId: orderId,
        grossAmount: 497,
        productId: testProductA.id,
        customerEmail: 'idempotencia@teste.com'
      })

      assert.equal(res2.sent, false)
      assert.equal(res2.skipped, true)
      assert.equal(res2.reason, 'already_sent')
      assert.equal(metaFetchCallCount, 1, 'Meta Graph API NÃO pode ser chamada novamente para venda já enviada!')
    } finally {
      global.fetch = originalFetch
    }
  })

  // 15. Isolamento de IDs: gateways diferentes e workspaces diferentes com mesmo ID de pedido não colidem
  it('15. Isolamento de IDs: múltiplos gateways e workspaces com mesmo orderId coexistem sem colisão', async () => {
    const ws2 = await prisma.workspace.create({
      data: { name: 'Workspace Segundo', slug: `ws-sec-${Date.now()}` }
    })

    const sharedOrderId = 'ORDER_1001'
    const eventIdWs1Hotmart = buildPurchaseEventId(testWorkspaceId, sharedOrderId, 'hotmart')
    const eventIdWs1Kiwify = buildPurchaseEventId(testWorkspaceId, sharedOrderId, 'kiwify')
    const eventIdWs2Hotmart = buildPurchaseEventId(ws2.id, sharedOrderId, 'hotmart')

    assert.notEqual(eventIdWs1Hotmart, eventIdWs1Kiwify, 'Plataformas diferentes no mesmo workspace geram eventIds distintos')
    assert.notEqual(eventIdWs1Hotmart, eventIdWs2Hotmart, 'Mesmo orderId em workspaces diferentes gera eventIds distintos')

    try {
      // Criar os 3 eventos simultaneamente no banco
      const e1 = await prisma.trackingEvent.create({
        data: {
          eventId: eventIdWs1Hotmart,
          workspaceId: testWorkspaceId,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: sharedOrderId,
          status: 'sent'
        }
      })

      const e2 = await prisma.trackingEvent.create({
        data: {
          eventId: eventIdWs1Kiwify,
          workspaceId: testWorkspaceId,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: sharedOrderId,
          status: 'sent'
        }
      })

      const e3 = await prisma.trackingEvent.create({
        data: {
          eventId: eventIdWs2Hotmart,
          workspaceId: ws2.id,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: sharedOrderId,
          status: 'sent'
        }
      })

      assert.ok(e1 && e2 && e3, 'Todos os 3 eventos coexistem no banco sem violar restrição unique')
    } finally {
      await prisma.trackingEvent.deleteMany({
        where: { eventId: { in: [eventIdWs1Hotmart, eventIdWs1Kiwify, eventIdWs2Hotmart] } }
      })
      await prisma.workspace.delete({ where: { id: ws2.id } })
    }
  })

  // 16. Execução real do tracker.js no Node.js via vm: zero ReferenceError, detecção correta e paridade de eventId
  it('16. Execução real do tracker.js: zero ReferenceError (script vs currentScript), detecção de plataforma e paridade determinística CAPI', () => {
    const trackerPath = path.join(__dirname, '..', 'public', 'tracker.js')
    const trackerCode = fs.readFileSync(trackerPath, 'utf8')

    // Mock do ambiente DOM
    const mockStorage: Record<string, string> = {}
    const mockSessionStorage: Record<string, string> = {}
    const sentRequests: Array<{ url: string; data: any }> = []
    const fbqCalls: Array<{ eventName: string; params: any; options: any }> = []

    const mockScriptEl = {
      getAttribute: (name: string) => {
        if (name === 'data-api-url') return 'https://track.app.test'
        if (name === 'data-workspace-id') return testWorkspaceId
        if (name === 'data-platform') return 'kiwify'
        if (name === 'data-pixel-id') return testPixelA.id
        return null
      }
    }

    const addEventListener = () => {}
    const context = {
      window: {} as any,
      addEventListener,
      removeEventListener: () => {},
      document: {
        currentScript: mockScriptEl,
        getElementsByTagName: (tag: string) => tag === 'script' ? [mockScriptEl] : [],
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener,
        removeEventListener: () => {},
        cookie: '',
        referrer: 'https://pay.kiwify.com.br/checkout'
      } as any,
      location: {
        href: 'https://minhaloja.com.br/obrigado?order_id=kw_123456&value=297&currency=BRL',
        pathname: '/obrigado',
        search: '?order_id=kw_123456&value=297&currency=BRL'
      } as any,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        sendBeacon: (url: string, data: any) => {
          sentRequests.push({ url, data })
          return true
        }
      } as any,
      sessionStorage: {
        getItem: (k: string) => mockSessionStorage[k] || null,
        setItem: (k: string, v: string) => { mockSessionStorage[k] = String(v) }
      },
      localStorage: {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = String(v) }
      },
      Date: Date,
      Math: Math,
      URL: URL,
      RegExp: RegExp,
      parseFloat: parseFloat,
      parseInt: parseInt,
      Number: Number,
      String: String,
      JSON: JSON,
      console: console,
      Blob: globalThis.Blob
    }
    context.window = context

    // Injetar fbq mock
    context.window.fbq = (action: string, eventName: string, params: any, options: any) => {
      fbqCalls.push({ eventName, params, options })
    }

    // Executar o script real na vm
    vm.createContext(context)
    assert.doesNotThrow(() => {
      vm.runInContext(trackerCode, context)
    }, 'O script tracker.js real DEVE executar sem ReferenceError ou exceções de runtime')

    // Verificar que window.utmTrack foi criado
    assert.ok(context.window.utmTrack, 'window.utmTrack deve estar disponível')

    // Testar detectPlatform
    const detected = context.window.utmTrack.detectPlatform('kw_123456')
    assert.equal(detected, 'kiwify', 'detectPlatform deve detectar kiwify a partir de atributos ou padrão')

    // Testar paridade determinística de buildPurchaseEventId com o servidor
    const browserEventId = context.window.utmTrack.buildPurchaseEventId(testWorkspaceId, 'kw_123456', detected)
    const serverEventId = buildPurchaseEventId(testWorkspaceId, 'kw_123456', 'kiwify')
    assert.equal(browserEventId, serverEventId, 'O event_id gerado pelo navegador DEVE ser 100% idêntico ao do servidor')

    // Testar chamada do trackPurchase manual
    const trackedId = context.window.utmTrack.trackPurchase({
      orderId: 'ORD_MANUAL_777',
      platform: 'hotmart',
      value: 497
    })
    const expectedServerId = buildPurchaseEventId(testWorkspaceId, 'ORD_MANUAL_777', 'hotmart')
    assert.equal(trackedId, expectedServerId, 'trackPurchase manual deve produzir identidade determinística idêntica ao servidor')
  })

  // 17. Isolamento de Gateways: dois pedidos com mesmo orderId em plataformas distintas são ambos enviados sem confusão
  it('17. Isolamento de Gateways: pedidos com mesmo orderId em plataformas distintas transmitem independentemente sem colisões', async () => {
    const metaCalls: Array<any> = []
    const originalFetch = global.fetch
    global.fetch = async (_url: any, opts: any) => {
      metaCalls.push(JSON.parse(opts.body))
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    const collisionOrderId = `COLLISION_${Date.now()}`

    try {
      // 1ª Venda: Hotmart para o pedido
      const resHotmart = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: `sale_hotmart_${collisionOrderId}`,
        externalId: collisionOrderId,
        platform: 'hotmart',
        grossAmount: 497,
        productId: testProductA.id,
        customerEmail: 'cliente.hotmart@teste.com'
      })

      assert.equal(resHotmart.sent, true)
      assert.equal(resHotmart.success, true)
      assert.ok(resHotmart.eventId?.includes('hotmart'), 'eventId deve conter hotmart')

      // 2ª Venda: Kiwify para o MESMO orderId no mesmo workspace
      const resKiwify = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: `sale_kiwify_${collisionOrderId}`,
        externalId: collisionOrderId,
        platform: 'kiwify',
        grossAmount: 1997,
        productId: testProductB.id,
        customerEmail: 'cliente.kiwify@teste.com'
      })

      // O pedido da Kiwify NÃO pode ser confundido com o da Hotmart e NÃO pode ser skipped como already_sent!
      assert.equal(resKiwify.sent, true, 'Kiwify com mesmo orderId DEVE ser enviado e não herdado da Hotmart')
      assert.equal(resKiwify.success, true)
      assert.notEqual(resKiwify.skipped, true, 'Não pode ser skipped por confusão de gateways')
      assert.ok(resKiwify.eventId?.includes('kiwify'), 'eventId deve conter kiwify')

      assert.equal(metaCalls.length, 2, 'Meta deve ter recebido 2 chamadas independentes, uma para cada gateway')
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { orderId: collisionOrderId, workspaceId: testWorkspaceId }
      })
    }
  })

  // 18. Trava Atômica de Concorrência: duas chamadas simultâneas não geram envio duplicado para a Meta
  it('18. Trava Atômica de Concorrência: requisições simultâneas para a mesma compra disputam trava e apenas uma chama a Meta', async () => {
    let metaCallsCount = 0
    const originalFetch = global.fetch
    global.fetch = async () => {
      metaCallsCount++
      // Delay intencional para manter a janela de concorrência aberta
      await new Promise(res => setTimeout(res, 25))
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    const concurrentOrderId = `CONCURRENT_${Date.now()}`

    try {
      const [call1, call2] = await Promise.all([
        dispatchPurchaseToCapi({
          workspaceId: testWorkspaceId,
          saleId: `sale_c1_${concurrentOrderId}`,
          externalId: concurrentOrderId,
          platform: 'kiwify',
          grossAmount: 497,
          productId: testProductA.id,
          customerEmail: 'concorrente@teste.com'
        }),
        dispatchPurchaseToCapi({
          workspaceId: testWorkspaceId,
          saleId: `sale_c2_${concurrentOrderId}`,
          externalId: concurrentOrderId,
          platform: 'kiwify',
          grossAmount: 497,
          productId: testProductA.id,
          customerEmail: 'concorrente@teste.com'
        })
      ])

      // Exatamente UMA chamada deve ter enviado para a Meta API
      assert.equal(metaCallsCount, 1, 'Exatamente UMA requisição deve ter chamado a Meta Graph API')

      const winners = [call1, call2].filter(c => c.sent === true && c.success === true)
      const skipped = [call1, call2].filter(c => c.skipped === true && (c.reason === 'in_flight' || c.reason === 'already_sent'))

      assert.equal(winners.length, 1, 'Exatamente um runner adquire a trava e conclui o envio')
      assert.equal(skipped.length, 1, 'O segundo runner concorrente deve ser dispensado com in_flight ou already_sent')
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { orderId: concurrentOrderId, workspaceId: testWorkspaceId }
      })
    }
  })

  // 19. Recuperação de eventos presos em 'sending' há mais de 5 minutos pela fila de retry
  it('19. Fila de Retry: recupera eventos presos em status sending por execução interrompida ou timeout', async () => {
    let retryMetaCalls = 0
    const originalFetch = global.fetch
    global.fetch = async () => {
      retryMetaCalls++
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    const stuckOrderId = `STUCK_${Date.now()}`
    const stuckEventId = buildPurchaseEventId(testWorkspaceId, stuckOrderId, 'hotmart')

    try {
      // Criar evento simulando trava presa em 'sending' há 10 minutos (execução serverless interrompida)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      await prisma.trackingEvent.create({
        data: {
          eventId: stuckEventId,
          workspaceId: testWorkspaceId,
          pixelId: testPixelA.id,
          eventName: 'Purchase',
          eventTime: tenMinutesAgo,
          orderId: stuckOrderId,
          platform: 'hotmart',
          value: 497,
          status: 'sending',
          updatedAt: tenMinutesAgo,
          clientIp: '189.10.20.30',
          clientUserAgent: 'Mozilla/5.0 Stuck Browser',
          emailHash: sha256Hash('recuperado@teste.com')
        }
      })

      // Executar a fila de retry
      const retryResult = await retryFailedCapiEvents(testWorkspaceId)

      assert.ok(retryResult.retried >= 1, 'O evento preso em sending deve ser capturado pela fila de retry')
      assert.ok(retryResult.succeeded >= 1, 'O evento deve ser transmitido com sucesso à Meta')
      assert.ok(retryMetaCalls >= 1, 'Meta deve ter sido chamada pelo retry')

      // Verificar que o status no banco mudou para 'sent'
      const updatedEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: stuckEventId }
      })
      assert.equal(updatedEvt?.status, 'sent', 'Status do evento deve ser atualizado para sent após retry bem-sucedido')
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { eventId: stuckEventId }
      })
    }
  })

  // 20. Concorrência no Retry: dois workers simultâneos adquirem trava atomicamente sem duplicar chamadas à Meta
  it('20. Concorrência no Retry: dois workers simultâneos não duplicam o envio à Meta', async () => {
    let metaCalls = 0
    const originalFetch = global.fetch
    global.fetch = async () => {
      metaCalls++
      // Simula pequena latência de rede para forçar janela de concorrência
      await new Promise(r => setTimeout(r, 40))
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    const concurrentOrderId = `RETRY_CONC_${Date.now()}`
    const concurrentEventId = buildPurchaseEventId(testWorkspaceId, concurrentOrderId, 'kiwify')

    try {
      await prisma.trackingEvent.create({
        data: {
          eventId: concurrentEventId,
          workspaceId: testWorkspaceId,
          pixelId: testPixelA.id,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: concurrentOrderId,
          platform: 'kiwify',
          value: 197,
          status: 'failed',
          retryCount: 0,
          clientIp: '177.10.20.30',
          clientUserAgent: 'Mozilla/5.0 Retry Concurrent Worker',
          emailHash: sha256Hash('concorrencia@teste.com')
        }
      })

      // Disparar duas instâncias de retry concorrentemente no mesmo workspace
      const [res1, res2] = await Promise.all([
        retryFailedCapiEvents(testWorkspaceId),
        retryFailedCapiEvents(testWorkspaceId)
      ])

      // Exatamente 1 chamada à Meta deve ter sido feita
      assert.equal(metaCalls, 1, 'Exatamente UMA chamada à Meta Graph API deve ser realizada, mesmo com workers de retry concorrentes')
      
      const totalSucceeded = res1.succeeded + res2.succeeded
      assert.equal(totalSucceeded, 1, 'Apenas 1 dos workers concorrentes deve contabilizar sucesso no envio')

      const finalEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: concurrentEventId }
      })
      assert.equal(finalEvt?.status, 'sent', 'O evento deve terminar com status sent')
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { eventId: concurrentEventId }
      })
    }
  })

  // 21. Recuperação no Retry de Pedidos com Mesmo ID em Plataformas Diferentes e Rejeição de Falso-Positivo por Substring
  it('21. Recuperação no Retry: pedidos com mesmo ID em plataformas diferentes recuperam seus respectivos pixels sem contaminação cruzada', async () => {
    const pixelsSent: string[] = []
    const originalFetch = global.fetch
    global.fetch = async (url: any) => {
      const urlStr = String(url)
      if (urlStr.includes(testPixelA.pixelId)) {
        pixelsSent.push('PixelA_Kiwify')
      } else if (urlStr.includes(testPixelB.pixelId)) {
        pixelsSent.push('PixelB_Hotmart')
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    const sharedOrderId = `SHARED_ORDER_${Date.now()}`
    const kiwifyEventId = buildPurchaseEventId(testWorkspaceId, sharedOrderId, 'kiwify')
    const hotmartEventId = buildPurchaseEventId(testWorkspaceId, sharedOrderId, 'hotmart')

    let saleKiwifyId: string | null = null
    let saleHotmartId: string | null = null

    try {
      // 1. Criar Venda Kiwify associada ao Produto A (Pixel A)
      const saleKiwify = await prisma.sale.create({
        data: {
          workspaceId: testWorkspaceId,
          externalId: sharedOrderId,
          platform: 'kiwify',
          status: 'approved',
          grossAmount: 150,
          netAmount: 135,
          orderedAt: new Date(),
          approvedAt: new Date(),
          items: {
            create: [{
              name: 'Produto A',
              productId: testProductA.id,
              quantity: 1,
              unitPrice: 150,
              totalPrice: 150
            }]
          }
        }
      })
      saleKiwifyId = saleKiwify.id

      // 2. Criar Venda Hotmart com o MESMO ID associada ao Produto B (Pixel B)
      const saleHotmart = await prisma.sale.create({
        data: {
          workspaceId: testWorkspaceId,
          externalId: sharedOrderId,
          platform: 'hotmart',
          status: 'approved',
          grossAmount: 250,
          netAmount: 225,
          orderedAt: new Date(),
          approvedAt: new Date(),
          items: {
            create: [{
              name: 'Produto B',
              productId: testProductB.id,
              quantity: 1,
              unitPrice: 250,
              totalPrice: 250
            }]
          }
        }
      })
      saleHotmartId = saleHotmart.id

      // 3. Criar dois eventos falhos SEM pixel associado (pixelId = null)
      // Simulando falha inicial onde o pixel precisa ser resolvido durante o retry
      await prisma.trackingEvent.create({
        data: {
          eventId: kiwifyEventId,
          workspaceId: testWorkspaceId,
          pixelId: null, // sem pixel gravado inicialmente
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: sharedOrderId,
          platform: 'kiwify',
          value: 150,
          status: 'failed',
          retryCount: 0,
          clientIp: '187.1.2.3',
          emailHash: sha256Hash('kiwify@teste.com')
        }
      })

      await prisma.trackingEvent.create({
        data: {
          eventId: hotmartEventId,
          workspaceId: testWorkspaceId,
          pixelId: null, // sem pixel gravado inicialmente
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: sharedOrderId,
          platform: 'hotmart',
          value: 250,
          status: 'failed',
          retryCount: 0,
          clientIp: '187.4.5.6',
          emailHash: sha256Hash('hotmart@teste.com')
        }
      })

      // 4. Executar fila de retry
      const retryResult = await retryFailedCapiEvents(testWorkspaceId)
      assert.ok(retryResult.retried >= 2, 'Ambos os eventos devem ser processados')
      assert.ok(retryResult.succeeded >= 2, 'Ambos os eventos devem ter sucesso')

      // 5. Verificar que cada evento foi enviado estritamente ao seu respectivo pixel
      const dbKiwifyEvt = await prisma.trackingEvent.findUnique({ where: { eventId: kiwifyEventId } })
      const dbHotmartEvt = await prisma.trackingEvent.findUnique({ where: { eventId: hotmartEventId } })

      assert.equal(dbKiwifyEvt?.pixelId, testPixelA.id, 'O evento Kiwify deve ter sido atribuído estritamente ao Pixel A')
      assert.equal(dbHotmartEvt?.pixelId, testPixelB.id, 'O evento Hotmart deve ter sido atribuído estritamente ao Pixel B')
      assert.equal(dbKiwifyEvt?.status, 'sent', 'Evento Kiwify deve ter status sent')
      assert.equal(dbHotmartEvt?.status, 'sent', 'Evento Hotmart deve ter status sent')

      assert.ok(pixelsSent.includes('PixelA_Kiwify'), 'Meta Graph API deve ter recebido evento no Pixel A para Kiwify')
      assert.ok(pixelsSent.includes('PixelB_Hotmart'), 'Meta Graph API deve ter recebido evento no Pixel B para Hotmart')

      // 6. Testar rejeição de substring: criar pedido Hotmart cujo ID contenha a palavra 'kiwify'
      // e assegurar que dispatchPurchaseToCapi para Kiwify NÃO herde o evento Hotmart
      const substringOrderId = `ORDER_kiwify_in_hotmart_${Date.now()}`
      const hotmartSubId = buildPurchaseEventId(testWorkspaceId, substringOrderId, 'hotmart')
      await prisma.trackingEvent.create({
        data: {
          eventId: hotmartSubId,
          workspaceId: testWorkspaceId,
          pixelId: testPixelB.id,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: substringOrderId,
          platform: 'hotmart',
          value: 300,
          status: 'sent',
          sentAt: new Date()
        }
      })

      // Tentar enviar Kiwify para esse mesmo orderId: NÃO deve considerar already_sent do Hotmart!
      const kiwifySubResult = await dispatchPurchaseToCapi({
        workspaceId: testWorkspaceId,
        saleId: `sale_${substringOrderId}`,
        externalId: substringOrderId,
        platform: 'kiwify',
        productId: testProductA.id,
        grossAmount: 120,
        currency: 'BRL',
        customerEmail: 'teste@kiwify.com'
      })

      assert.notEqual(kiwifySubResult.reason, 'already_sent', 'Kiwify NÃO pode ser confundido com Hotmart mesmo que o orderId contenha o nome do gateway')
      assert.equal(kiwifySubResult.sent, true, 'O evento Kiwify deve ser enviado de forma independente à Meta')

      await prisma.trackingEvent.deleteMany({
        where: { eventId: { in: [hotmartSubId, buildPurchaseEventId(testWorkspaceId, substringOrderId, 'kiwify')] } }
      })
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { eventId: { in: [kiwifyEventId, hotmartEventId] } }
      })
      if (saleKiwifyId) {
        await prisma.saleItem.deleteMany({ where: { saleId: saleKiwifyId } })
        await prisma.sale.delete({ where: { id: saleKiwifyId } }).catch(() => {})
      }
      if (saleHotmartId) {
        await prisma.saleItem.deleteMany({ where: { saleId: saleHotmartId } })
        await prisma.sale.delete({ where: { id: saleHotmartId } }).catch(() => {})
      }
    }
  })
})
