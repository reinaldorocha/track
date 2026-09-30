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
  normalizeSaleUtms,
  upsertSale
} from '../src/lib/integrations/normalizer'
import { attemptAttribution } from '../src/lib/tracking/attribution'
import { POST as handleSessionPost } from '../src/app/api/tracking/session/route'
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

    // Caso 1: Plataforma ausente -> Ambos DEVEM usar 'direct'
    const browserDirect = context.window.utmTrack.buildPurchaseEventId('ws1', '1001', undefined)
    const serverDirect = buildPurchaseEventId('ws1', '1001', undefined)
    assert.equal(browserDirect, 'purchase_ws1_direct_1001', 'Navegador sem plataforma deve gerar purchase_ws1_direct_1001')
    assert.equal(serverDirect, 'purchase_ws1_direct_1001', 'Servidor sem plataforma deve gerar purchase_ws1_direct_1001')
    assert.equal(browserDirect, serverDirect, 'Plataforma ausente DEVE gerar exatamente o mesmo ID no navegador e servidor')

    // Caso 2: Caracteres especiais no orderId (ex: ABC/123 vs ABC_123)
    const browserSlash = context.window.utmTrack.buildPurchaseEventId('ws1', 'ABC/123', 'kiwify')
    const serverSlash = buildPurchaseEventId('ws1', 'ABC/123', 'kiwify')
    assert.equal(browserSlash, 'purchase_ws1_kiwify_ABC/123', 'Navegador deve preservar / sem substituição')
    assert.equal(serverSlash, 'purchase_ws1_kiwify_ABC/123', 'Servidor deve preservar / sem substituição')
    assert.equal(browserSlash, serverSlash, 'Pedido com barra DEVE gerar IDs idênticos no navegador e servidor')

    const browserUnderscore = context.window.utmTrack.buildPurchaseEventId('ws1', 'ABC_123', 'kiwify')
    const serverUnderscore = buildPurchaseEventId('ws1', 'ABC_123', 'kiwify')
    assert.equal(browserUnderscore, 'purchase_ws1_kiwify_ABC_123')
    assert.equal(serverUnderscore, 'purchase_ws1_kiwify_ABC_123')
    assert.notEqual(browserSlash, browserUnderscore, 'Pedidos distintos ABC/123 e ABC_123 NÃO podem virar o mesmo ID')

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

  // 22. Retry: sem plataforma declarada, bloqueia resolução ambígua de venda entre múltiplos gateways
  it('22. Retry: sem plataforma declarada, bloqueia resolução ambígua de venda entre múltiplos gateways', async () => {
    let metaCalls = 0
    const originalFetch = global.fetch
    global.fetch = async () => {
      metaCalls++
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    const ambigOrderId = `AMBIG_NO_PLAT_${Date.now()}`
    const ambigEventId = buildPurchaseEventId(testWorkspaceId, ambigOrderId, undefined)

    let sale1Id: string | null = null
    let sale2Id: string | null = null

    try {
      // 1. Criar duas vendas no mesmo workspace com o mesmo ID em gateways diferentes
      const s1 = await prisma.sale.create({
        data: {
          workspaceId: testWorkspaceId,
          externalId: ambigOrderId,
          platform: 'kiwify',
          status: 'approved',
          grossAmount: 100,
          netAmount: 90,
          orderedAt: new Date(),
          approvedAt: new Date(),
          items: {
            create: [{
              name: 'Produto A Kiwify',
              productId: testProductA.id,
              quantity: 1,
              unitPrice: 100,
              totalPrice: 100
            }]
          }
        }
      })
      sale1Id = s1.id

      const s2 = await prisma.sale.create({
        data: {
          workspaceId: testWorkspaceId,
          externalId: ambigOrderId,
          platform: 'hotmart',
          status: 'approved',
          grossAmount: 200,
          netAmount: 180,
          orderedAt: new Date(),
          approvedAt: new Date(),
          items: {
            create: [{
              name: 'Produto B Hotmart',
              productId: testProductB.id,
              quantity: 1,
              unitPrice: 200,
              totalPrice: 200
            }]
          }
        }
      })
      sale2Id = s2.id

      // 2. Criar evento com status failed, sem pixel e SEM plataforma
      await prisma.trackingEvent.create({
        data: {
          eventId: ambigEventId,
          workspaceId: testWorkspaceId,
          pixelId: null,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: ambigOrderId,
          platform: null,
          value: 100,
          status: 'failed',
          retryCount: 0,
          emailHash: sha256Hash('sem_plataforma@teste.com')
        }
      })

      // 3. Executar retry
      const retryResult = await retryFailedCapiEvents(testWorkspaceId)

      // Deve bloquear a resolução ambígua e NÃO enviar para a Meta
      assert.equal(metaCalls, 0, 'Nenhuma chamada à Meta deve ser feita em caso de ambiguidade entre múltiplos gateways sem plataforma declarada')

      const finalEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: ambigEventId }
      })
      assert.equal(finalEvt?.status, 'failed', 'Status deve permanecer failed para correção ou intervenção manual')
      assert.ok(
        String(finalEvt?.capiError).includes('Resolução ambígua de venda no retry'),
        'Erro deve indicar explicitamente que a resolução da venda foi bloqueada por ambiguidade'
      )
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { eventId: ambigEventId }
      })
      if (sale1Id) {
        await prisma.saleItem.deleteMany({ where: { saleId: sale1Id } })
        await prisma.sale.delete({ where: { id: sale1Id } }).catch(() => {})
      }
      if (sale2Id) {
        await prisma.saleItem.deleteMany({ where: { saleId: sale2Id } })
        await prisma.sale.delete({ where: { id: sale2Id } }).catch(() => {})
      }
    }
  })

  // 23. Retry: rejeita pixel previamente associado caso ele tenha sido desativado após a falha
  it('23. Retry: rejeita pixel previamente associado caso ele tenha sido desativado após a falha', async () => {
    let metaCalls = 0
    const originalFetch = global.fetch
    global.fetch = async () => {
      metaCalls++
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    let deactPixelId: string | null = null
    const deactOrderId = `DEACT_ORDER_${Date.now()}`
    const deactEventId = buildPurchaseEventId(testWorkspaceId, deactOrderId, 'kiwify')

    try {
      // 1. Criar um pixel temporário que depois será desativado
      const deactPixel = await prisma.pixel.create({
        data: {
          workspaceId: testWorkspaceId,
          name: 'Pixel Que Sera Desativado',
          pixelId: '999999999999999',
          accessTokenEnc: encrypt('EAABbDeactTokenTest'),
          status: 'active'
        }
      })
      deactPixelId = deactPixel.id

      // 2. Criar evento com status failed associado a este pixel
      await prisma.trackingEvent.create({
        data: {
          eventId: deactEventId,
          workspaceId: testWorkspaceId,
          pixelId: deactPixel.id,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: deactOrderId,
          platform: 'kiwify',
          value: 120,
          status: 'failed',
          retryCount: 0,
          emailHash: sha256Hash('pixel_desativado@teste.com')
        }
      })

      // 3. Desativar o pixel (simulando alteração no painel de configurações do usuário)
      await prisma.pixel.update({
        where: { id: deactPixel.id },
        data: { status: 'inactive' }
      })

      // 4. Executar fila de retry
      await retryFailedCapiEvents(testWorkspaceId)

      // 5. Garantir que nenhuma chamada foi feita ao pixel desativado
      assert.equal(metaCalls, 0, 'O retry JAMAIS deve enviar eventos para um pixel inativo, mesmo que associado no passado')

      const finalEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: deactEventId }
      })
      assert.equal(finalEvt?.status, 'failed', 'O status do evento deve permanecer failed')
      assert.ok(
        String(finalEvt?.capiError).includes('inativo') || String(finalEvt?.capiError).includes('não encontrado'),
        'Erro deve registrar que o pixel está inativo ou não pôde ser utilizado'
      )
    } finally {
      global.fetch = originalFetch
      await prisma.trackingEvent.deleteMany({
        where: { eventId: deactEventId }
      })
      if (deactPixelId) {
        await prisma.pixel.delete({ where: { id: deactPixelId } }).catch(() => {})
      }
    }
  })

  // 24. Pixel A vinculado inativo + somente Pixel B ativo no workspace: tanto envio inicial quanto retry devem falhar com 0 chamadas à Meta (NUNCA fazer fallback para o Pixel B ativo)
  it('24. Pixel A vinculado inativo + somente Pixel B ativo no workspace: tanto envio inicial quanto retry devem falhar com 0 chamadas à Meta (NUNCA fazer fallback para o Pixel B ativo)', async () => {
    let metaCalls = 0
    const calledUrls: string[] = []
    const originalFetch = global.fetch
    global.fetch = async (url: any) => {
      metaCalls++
      calledUrls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    let isoWsId: string | null = null
    const orderInitId = `ISO_INIT_${Date.now()}`
    const orderRetryDirectId = `ISO_RETRY_DIRECT_${Date.now()}`
    const orderRetrySaleId = `ISO_RETRY_SALE_${Date.now()}`

    try {
      // 1. Criar workspace isolado com exatamente 1 pixel inativo e 1 pixel ativo
      const isoWs = await prisma.workspace.create({
        data: {
          name: 'Workspace Inactive Fallback Isolation',
          slug: `iso-fallback-${Date.now()}`
        }
      })
      isoWsId = isoWs.id

      // Pixel A (Inativo)
      const pixelA = await prisma.pixel.create({
        data: {
          workspaceId: isoWs.id,
          name: 'Pixel A Inativo',
          pixelId: '888888888888888',
          accessTokenEnc: encrypt('EAABmocktokenA'),
          status: 'inactive'
        }
      })

      // Pixel B (Único Pixel Ativo no Workspace)
      const pixelB = await prisma.pixel.create({
        data: {
          workspaceId: isoWs.id,
          name: 'Pixel B Unico Ativo',
          pixelId: '777777777777777',
          accessTokenEnc: encrypt('EAABmocktokenB'),
          status: 'active'
        }
      })

      // Produto A vinculado explicitamente ao Pixel A (que está inativo)
      const productA = await prisma.product.create({
        data: {
          workspaceId: isoWs.id,
          name: 'Produto A Vinculado a Pixel Inativo',
          price: 297,
          pixelId: pixelA.id
        }
      })

      // Venda vinculada ao Produto A (para teste de retry via items da venda)
      await prisma.sale.create({
        data: {
          workspaceId: isoWs.id,
          externalId: orderRetrySaleId,
          platform: 'kiwify',
          status: 'approved',
          grossAmount: 297,
          netAmount: 270,
          orderedAt: new Date(),
          approvedAt: new Date(),
          items: {
            create: [{
              name: 'Item Produto A',
              productId: productA.id,
              quantity: 1,
              unitPrice: 297,
              totalPrice: 297
            }]
          }
        }
      })

      // ==========================================
      // PARTE 1: Envio Inicial (dispatchPurchaseToCapi)
      // ==========================================
      const resInitial = await dispatchPurchaseToCapi({
        workspaceId: isoWs.id,
        saleId: `sale_${orderInitId}`,
        externalId: orderInitId,
        grossAmount: 297,
        productId: productA.id,
        customerEmail: 'cliente_inicial@teste.com'
      })

      assert.equal(resInitial.sent, false, 'Envio inicial não deve ser transmitido quando o pixel vinculado ao produto estiver inativo')
      assert.equal(resInitial.success, false)
      assert.equal(resInitial.reason, 'pixel_inactive_or_missing')
      assert.equal(metaCalls, 0, 'Envio inicial com pixel vinculado inativo DEVE resultar em 0 chamadas à Meta (Pixel B ativo NÃO deve ser usado como fallback)')

      const initEventId = buildPurchaseEventId(isoWs.id, orderInitId, undefined)
      const dbInitEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: initEventId }
      })
      assert.equal(dbInitEvt?.status, 'failed', 'Evento de envio inicial deve ser gravado com status failed')
      assert.ok(
        String(dbInitEvt?.capiError).includes('inativo'),
        'Erro gravado no evento inicial deve apontar que o pixel vinculado está inativo'
      )

      // ==========================================
      // PARTE 2: Retry via pixelId direto no evento
      // ==========================================
      const eventRetryDirectId = buildPurchaseEventId(isoWs.id, orderRetryDirectId, 'kiwify')
      await prisma.trackingEvent.create({
        data: {
          eventId: eventRetryDirectId,
          workspaceId: isoWs.id,
          pixelId: pixelA.id, // Pixel A inativo
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: orderRetryDirectId,
          platform: 'kiwify',
          value: 297,
          status: 'failed',
          retryCount: 0,
          emailHash: sha256Hash('retry_direct@teste.com')
        }
      })

      // ==========================================
      // PARTE 3: Retry via produto da venda (pixelId: null no evento)
      // ==========================================
      const eventRetrySaleId = buildPurchaseEventId(isoWs.id, orderRetrySaleId, 'kiwify')
      await prisma.trackingEvent.create({
        data: {
          eventId: eventRetrySaleId,
          workspaceId: isoWs.id,
          pixelId: null, // Sem pixel direto, deve resolver via items -> productA -> pixelA (inativo)
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: orderRetrySaleId,
          platform: 'kiwify',
          value: 297,
          status: 'failed',
          retryCount: 0,
          emailHash: sha256Hash('retry_sale@teste.com')
        }
      })

      // Executar a fila de retry
      await retryFailedCapiEvents(isoWs.id)

      // Verificar que ZERO chamadas foram feitas à Meta durante todo o processo
      assert.equal(metaCalls, 0, 'Retry DEVE resultar em ZERO chamadas à Meta quando os produtos/eventos estão vinculados a um pixel inativo (Pixel B nunca deve receber)')
      assert.equal(calledUrls.length, 0, 'Nenhuma URL de Pixel deve ter sido requisitada')

      const dbRetryDirectEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: eventRetryDirectId }
      })
      assert.equal(dbRetryDirectEvt?.status, 'failed', 'Evento de retry direto deve permanecer failed')
      assert.ok(
        String(dbRetryDirectEvt?.capiError).includes('inativo'),
        'Erro do retry direto deve registrar que o pixel explicitamente vinculado está inativo'
      )

      const dbRetrySaleEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: eventRetrySaleId }
      })
      assert.equal(dbRetrySaleEvt?.status, 'failed', 'Evento de retry resolvido por produto deve permanecer failed')
      assert.ok(
        String(dbRetrySaleEvt?.capiError).includes('inativo'),
        'Erro do retry resolvido por produto deve registrar que o pixel vinculado ao produto está inativo'
      )
    } finally {
      global.fetch = originalFetch
      if (isoWsId) {
        await prisma.trackingEvent.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.saleItem.deleteMany({ where: { sale: { workspaceId: isoWsId } } })
        await prisma.sale.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.product.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.pixel.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.workspace.delete({ where: { id: isoWsId } }).catch(() => {})
      }
    }
  })

  // 25. Resolução de ID interno no registro de falha: directPixelId numérico inativo salva ID interno do banco, e pixel inexistente não quebra FK nem deixa evento preso em sending
  it('25. Resolução de ID interno no registro de falha: directPixelId numérico inativo salva ID interno do banco, e pixel inexistente não quebra FK nem deixa evento preso em sending', async () => {
    let isoWsId: string | null = null
    const orderInactiveNumeric = `ORDER_INACTIVE_NUM_${Date.now()}`
    const orderNonExistent = `ORDER_NONEXISTENT_${Date.now()}`

    try {
      // 1. Criar workspace isolado
      const isoWs = await prisma.workspace.create({
        data: {
          name: 'Workspace FK Resolution Test',
          slug: `iso-fk-${Date.now()}`
        }
      })
      isoWsId = isoWs.id

      // Pixel inativo com pixelId numérico da Meta
      const pixelInactive = await prisma.pixel.create({
        data: {
          workspaceId: isoWs.id,
          name: 'Pixel Inativo Numérico',
          pixelId: '555555555555555',
          accessTokenEnc: encrypt('EAABmocktokenInactive'),
          status: 'inactive'
        }
      })

      // CASO A: directPixelId passado como ID numérico de pixel existente porém inativo
      const resA = await dispatchPurchaseToCapi({
        workspaceId: isoWs.id,
        saleId: `sale_${orderInactiveNumeric}`,
        externalId: orderInactiveNumeric,
        grossAmount: 150,
        pixelId: '555555555555555',
        customerEmail: 'cliente_inativo_num@teste.com'
      })

      assert.equal(resA.sent, false)
      assert.equal(resA.reason, 'pixel_inactive_or_missing')

      const eventIdA = buildPurchaseEventId(isoWs.id, orderInactiveNumeric, undefined)
      const dbEvtA = await prisma.trackingEvent.findUnique({
        where: { eventId: eventIdA }
      })

      assert.ok(dbEvtA, 'Evento A deve ter sido gravado')
      assert.equal(dbEvtA.status, 'failed', 'Evento não deve ficar preso em sending')
      assert.equal(dbEvtA.pixelId, pixelInactive.id, 'O campo TrackingEvent.pixelId deve receber o ID interno (cuid), não o ID numérico da Meta')
      assert.equal(dbEvtA.requestedPixelId, '555555555555555', 'O campo requestedPixelId deve persistir o ID solicitado')
      assert.ok(String(dbEvtA.capiError).includes('555555555555555'), 'A mensagem de erro deve preservar o identificador solicitado')
      assert.ok(String(dbEvtA.capiError).includes('inativo'), 'Mensagem deve indicar que o pixel está inativo')

      // CASO B: directPixelId passado como ID numérico de pixel totalmente inexistente no banco
      const resB = await dispatchPurchaseToCapi({
        workspaceId: isoWs.id,
        saleId: `sale_${orderNonExistent}`,
        externalId: orderNonExistent,
        grossAmount: 200,
        pixelId: '999999999999999',
        customerEmail: 'cliente_inexistente@teste.com'
      })

      assert.equal(resB.sent, false)
      assert.equal(resB.reason, 'pixel_inactive_or_missing')

      const eventIdB = buildPurchaseEventId(isoWs.id, orderNonExistent, undefined)
      const dbEvtB = await prisma.trackingEvent.findUnique({
        where: { eventId: eventIdB }
      })

      assert.ok(dbEvtB, 'Evento B deve ter sido gravado')
      assert.equal(dbEvtB.status, 'failed', 'Evento de pixel inexistente deve ser gravado com status failed e JAMAIS ficar preso em sending')
      assert.equal(dbEvtB.pixelId, null, 'O campo TrackingEvent.pixelId deve permanecer null quando o pixel não existe no banco, evitando erro de chave estrangeira')
      assert.equal(dbEvtB.requestedPixelId, '999999999999999', 'O campo requestedPixelId deve persistir o identificador solicitado mesmo sem FK')
      assert.ok(String(dbEvtB.capiError).includes('999999999999999'), 'A mensagem de erro deve preservar o identificador solicitado')
      assert.ok(String(dbEvtB.capiError).includes('não foi encontrado'), 'Mensagem deve indicar que o pixel não foi encontrado no workspace')

    } finally {
      if (isoWsId) {
        await prisma.trackingEvent.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.pixel.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.workspace.delete({ where: { id: isoWsId } }).catch(() => {})
      }
    }
  })

  // 26. Retry com requestedPixelId inexistente + somente Pixel B ativo no workspace: ZERO chamadas à Meta e NENHUM envio para Pixel B
  it('26. Retry com requestedPixelId inexistente + somente Pixel B ativo no workspace: ZERO chamadas à Meta e NENHUM envio para Pixel B', async () => {
    let metaCalls = 0
    const calledUrls: string[] = []
    const originalFetch = global.fetch
    global.fetch = async (url: any) => {
      metaCalls++
      calledUrls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 })
      } as any
    }

    let isoWsId: string | null = null
    const nonExistentPixelId = '999999999999999'
    const orderPurchaseId = `RETRY_NONEXIST_PURCHASE_${Date.now()}`
    const navEventId = `evt_nav_nonexist_${Date.now()}`

    try {
      // 1. Criar workspace isolado
      const isoWs = await prisma.workspace.create({
        data: {
          name: 'Workspace Retry Nonexistent Pixel Test',
          slug: `iso-retry-nonexist-${Date.now()}`
        }
      })
      isoWsId = isoWs.id

      // 2. Criar APENAS o Pixel B ativo no workspace
      const pixelB = await prisma.pixel.create({
        data: {
          workspaceId: isoWs.id,
          name: 'Pixel B Unico Ativo',
          pixelId: '777777777777777',
          accessTokenEnc: encrypt('EAABmocktokenB'),
          status: 'active'
        }
      })

      // 3. Criar evento de Purchase com status failed, pixelId null e requestedPixelId = Pixel A (inexistente)
      const purchaseEventId = buildPurchaseEventId(isoWs.id, orderPurchaseId, 'kiwify')
      await prisma.trackingEvent.create({
        data: {
          eventId: purchaseEventId,
          workspaceId: isoWs.id,
          pixelId: null,
          requestedPixelId: nonExistentPixelId,
          eventName: 'Purchase',
          eventTime: new Date(),
          orderId: orderPurchaseId,
          platform: 'kiwify',
          value: 197,
          status: 'failed',
          capiError: `O pixel explicitamente vinculado (${nonExistentPixelId}) não foi encontrado no workspace.`,
          retryCount: 0,
          emailHash: sha256Hash('retry_nonexist@teste.com')
        }
      })

      // 4. Criar evento de Navegação (PageView) com status failed, pixelId null e requestedPixelId = Pixel A (inexistente)
      await prisma.trackingEvent.create({
        data: {
          eventId: navEventId,
          workspaceId: isoWs.id,
          pixelId: null,
          requestedPixelId: nonExistentPixelId,
          eventName: 'PageView',
          eventTime: new Date(),
          sourceUrl: 'https://exemplo.com/landing-page',
          status: 'failed',
          capiError: `Pixel ${nonExistentPixelId} is not found in workspace`,
          retryCount: 0
        }
      })

      // 5. Executar o retry no workspace
      await retryFailedCapiEvents(isoWs.id)

      // 6. Verificar que ZERO chamadas foram feitas para a Meta (Pixel B JAMAIS deve receber esses eventos)
      assert.equal(metaCalls, 0, 'ZERO chamadas devem ser feitas à Meta: o retry NÃO deve usar o Pixel B ativo como fallback quando há requestedPixelId')
      assert.equal(calledUrls.length, 0, 'Nenhuma URL de Pixel deve ter sido acessada')

      const dbPurchaseEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: purchaseEventId }
      })
      assert.equal(dbPurchaseEvt?.status, 'failed', 'Status da compra deve permanecer failed')
      assert.ok(
        String(dbPurchaseEvt?.capiError).includes(nonExistentPixelId),
        'Erro do evento deve continuar referenciando o requestedPixelId não encontrado'
      )

      const dbNavEvt = await prisma.trackingEvent.findUnique({
        where: { eventId: navEventId }
      })
      assert.equal(dbNavEvt?.status, 'failed', 'Status da navegação deve permanecer failed')
      assert.ok(
        String(dbNavEvt?.capiError).includes(nonExistentPixelId),
        'Erro do evento de navegação deve continuar referenciando o requestedPixelId não encontrado'
      )

      // 7. Agora simular que o usuário posteriormente cadastra e ativa o Pixel A (999999999999999)
      const pixelA = await prisma.pixel.create({
        data: {
          workspaceId: isoWs.id,
          name: 'Pixel A Recem Criado',
          pixelId: nonExistentPixelId,
          accessTokenEnc: encrypt('EAABmocktokenA_New'),
          status: 'active'
        }
      })

      // 8. Reexecutar o retry: agora os eventos DEVEM ser enviados para o Pixel A recém-criado!
      metaCalls = 0
      calledUrls.length = 0

      await retryFailedCapiEvents(isoWs.id)

      assert.ok(metaCalls > 0, 'Com o Pixel A cadastrado e ativo, o retry deve realizar o disparo para a Meta')
      assert.ok(calledUrls.every(url => url.includes(nonExistentPixelId)), 'O disparo deve ser direcionado exclusivamente ao Pixel A solicitado')

      const dbPurchaseRecovered = await prisma.trackingEvent.findUnique({
        where: { eventId: purchaseEventId }
      })
      assert.equal(dbPurchaseRecovered?.status, 'sent', 'Após ativação do Pixel A, o evento deve ser transmitido com status sent')
      assert.equal(dbPurchaseRecovered?.pixelId, pixelA.id, 'O campo FK pixelId deve ser preenchido com o CUID interno do Pixel A recém-ativado')

    } finally {
      global.fetch = originalFetch
      if (isoWsId) {
        await prisma.trackingEvent.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.pixel.deleteMany({ where: { workspaceId: isoWsId } })
        await prisma.workspace.delete({ where: { id: isoWsId } }).catch(() => {})
      }
    }
  })

  // 27. Persistência de UTMs entre visitas no tracker.js (Last-Click de Campanha)
  it('27. Persistência de UTMs entre visitas no tracker.js (Last-Click de Campanha): A -> Retorno Direto -> Compra; A -> B -> Compra; Expiração de TTL; Substituição Atômica e Resiliência de Storage', async () => {
    const trackerPath = path.join(__dirname, '..', 'public', 'tracker.js')
    const trackerCode = fs.readFileSync(trackerPath, 'utf8')

    function runTrackerInVm(options: {
      url: string
      referrer?: string
      cookies?: string
      localStorageData?: Record<string, string>
      sessionStorageData?: Record<string, string>
      scriptAttrs?: Record<string, string>
      throwOnLocalStorageSet?: boolean
      domElements?: Array<{ tag: string; attrs: Record<string, string | undefined> }>
    }) {
      const mockStorage = { ...(options.localStorageData || {}) }
      const mockSession = { ...(options.sessionStorageData || {}) }
      const sentBeacons: Array<{ url: string; data: any; rawText?: string }> = []
      const sentFetches: Array<{ url: string; data: any }> = []

      const scriptAttrs: Record<string, string> = {
        'data-api-url': 'https://track.test',
        'data-workspace-id': testWorkspaceId,
        'data-pixel-id': testPixelA.id,
        ...(options.scriptAttrs || {})
      }

      const mockScript = {
        getAttribute: (attr: string) => scriptAttrs[attr] || null
      }

      const elements = (options.domElements || []).map(el => {
        let hrefVal = el.attrs['href'] || ''
        let actionVal = el.attrs['action'] || ''
        let srcVal = el.attrs['src'] || ''
        const item: any = {
          tagName: el.tag.toUpperCase(),
          getAttribute: (name: string) => {
            if (name === 'href') return hrefVal
            if (name === 'action') return actionVal
            if (name === 'src') return srcVal
            return el.attrs[name] || null
          },
          setAttribute: (name: string, val: string) => {
            if (name === 'href') hrefVal = val
            if (name === 'action') actionVal = val
            if (name === 'src') srcVal = val
            el.attrs[name] = val
          },
          get href() { return hrefVal },
          set href(val: string) { hrefVal = val; el.attrs['href'] = val },
          get action() { return actionVal },
          set action(val: string) { actionVal = val; el.attrs['action'] = val },
          get src() { return srcVal },
          set src(val: string) { srcVal = val; el.attrs['src'] = val }
        }
        return item
      })

      const parsedUrl = new URL(options.url)
      let cookieJar = options.cookies || ''

      const context: any = {
        window: {} as any,
        addEventListener: () => {},
        removeEventListener: () => {},
        document: {
          currentScript: mockScript,
          getElementsByTagName: (tag: string) => tag === 'script' ? [mockScript] : [],
          querySelectorAll: (sel: string) => {
            if (sel.includes('a[href]')) return elements.filter(e => e.tagName === 'A')
            if (sel.includes('form[action]')) return elements.filter(e => e.tagName === 'FORM')
            if (sel.includes('iframe[src]')) return elements.filter(e => e.tagName === 'IFRAME')
            return []
          },
          querySelector: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
          get cookie() { return cookieJar },
          set cookie(val: string) {
            const parts = val.split(';')
            const [kv] = parts
            if (kv) {
              const [k, v] = kv.split('=')
              cookieJar = `${k.trim()}=${v.trim()}; ${cookieJar}`
            }
          },
          referrer: options.referrer || ''
        },
        location: {
          href: parsedUrl.href,
          pathname: parsedUrl.pathname,
          search: parsedUrl.search
        },
        navigator: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          sendBeacon: (url: string, data: any) => {
            const rawText = data?.payloadText || (typeof data === 'string' ? data : '')
            sentBeacons.push({ url, data, rawText })
            return true
          }
        },
        sessionStorage: {
          getItem: (k: string) => mockSession[k] || null,
          setItem: (k: string, v: string) => { mockSession[k] = String(v) },
          removeItem: (k: string) => { delete mockSession[k] }
        },
        localStorage: {
          getItem: (k: string) => mockStorage[k] || null,
          setItem: (k: string, v: string) => {
            if (options.throwOnLocalStorageSet) {
              const err = new Error('QuotaExceededError')
              err.name = 'QuotaExceededError'
              throw err
            }
            mockStorage[k] = String(v)
          },
          removeItem: (k: string) => { delete mockStorage[k] }
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
        Blob: class MockBlob {
          public payloadText: string
          constructor(parts: any[]) {
            this.payloadText = Array.isArray(parts) ? parts.join('') : String(parts || '')
          }
          async text() { return this.payloadText }
          toString() { return this.payloadText }
        },
        fetch: async (url: string, opts: any) => {
          sentFetches.push({ url, data: opts?.body })
          return { ok: true, json: async () => ({ success: true }) }
        }
      }
      context.window = context

      vm.createContext(context)
      vm.runInContext(trackerCode, context)

      return {
        context,
        utmTrack: context.window.utmTrack,
        mockStorage,
        mockSession,
        elements,
        sentBeacons,
        sentFetches,
        cookieJar
      }
    }

    try {
      // -------------------------------------------------------------------------
      // CENÁRIO 1: A -> Retorno Direto -> Compra
      // -------------------------------------------------------------------------
      const dom1 = [
        { tag: 'a', attrs: { href: 'https://pay.kiwify.com.br/checkout_a1' } },
        { tag: 'form', attrs: { action: 'https://pay.hotmart.com/checkout_a2' } },
        { tag: 'iframe', attrs: { src: 'https://checkout.cakto.com.br/checkout_a3' } }
      ]

      const visit1 = runTrackerInVm({
        url: 'https://meusite.com.br/landing?utm_source=facebook&utm_campaign=blackfriday&utm_medium=cpc&utm_content=video_a&src=facebook&sck=blackfriday',
        domElements: dom1
      })

      assert.equal(visit1.utmTrack.utms.source, 'facebook', 'Visita 1: source deve ser facebook')
      assert.equal(visit1.utmTrack.utms.campaign, 'blackfriday', 'Visita 1: campaign deve ser blackfriday')
      assert.equal(visit1.utmTrack.utms.content, 'video_a', 'Visita 1: content deve ser video_a')

      assert.ok(visit1.mockStorage['_utmt_campaign'], 'Visita 1: localStorage deve conter _utmt_campaign')
      const storedV1 = JSON.parse(visit1.mockStorage['_utmt_campaign'])
      assert.equal(storedV1.utms.source, 'facebook')
      assert.equal(storedV1.utms.campaign, 'blackfriday')
      assert.equal(storedV1.ttlDays, 30, 'TTL padrão deve ser 30 dias')
      assert.ok(typeof storedV1.timestamp === 'number', 'Timestamp deve estar presente')

      const decoratedLinkV1 = String(dom1[0]?.attrs['href'] || '')
      assert.ok(decoratedLinkV1.includes('utm_source=facebook'), 'Checkout 1 decorado com utm_source')
      assert.ok(decoratedLinkV1.includes('utm_campaign=blackfriday'), 'Checkout 1 decorado com utm_campaign')
      assert.ok(decoratedLinkV1.includes('src=facebook'), 'Checkout 1 decorado com src')
      assert.ok(decoratedLinkV1.includes('sck=blackfriday'), 'Checkout 1 decorado com sck')
      assert.ok(decoratedLinkV1.includes(`_utmt_sid=${visit1.utmTrack.sessionId}`), 'Checkout 1 decorado com sessionId')
      assert.ok(decoratedLinkV1.includes(`_utmt_vid=${visit1.utmTrack.visitorId}`), 'Checkout 1 decorado com visitorId')

      const visitorId = visit1.utmTrack.visitorId
      const sessionIdV1 = visit1.utmTrack.sessionId

      // Criar sessão 1 no banco
      await prisma.trackingSession.create({
        data: {
          sessionId: sessionIdV1,
          visitorId,
          workspaceId: testWorkspaceId,
          utmSource: visit1.utmTrack.utms.source,
          utmCampaign: visit1.utmTrack.utms.campaign,
          utmMedium: visit1.utmTrack.utms.medium,
          utmContent: visit1.utmTrack.utms.content,
          firstSeenAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          lastSeenAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        }
      })

      // Visita 2: Visitante volta diretamente 3 dias depois (sem UTMs na URL)
      const dom2 = [
        { tag: 'a', attrs: { href: 'https://pay.kiwify.com.br/checkout_a1' } }
      ]

      const visit2 = runTrackerInVm({
        url: 'https://meusite.com.br/landing',
        localStorageData: visit1.mockStorage,
        sessionStorageData: {},
        domElements: dom2
      })

      assert.equal(visit2.utmTrack.visitorId, visitorId, 'Visita 2: visitorId deve ser mantido persistente')
      assert.notEqual(visit2.utmTrack.sessionId, sessionIdV1, 'Visita 2: nova aba deve gerar novo sessionId')
      const sessionIdV2 = visit2.utmTrack.sessionId

      assert.equal(visit2.utmTrack.utms.source, 'facebook', 'Visita 2 direta: deve recuperar source do anúncio A')
      assert.equal(visit2.utmTrack.utms.campaign, 'blackfriday', 'Visita 2 direta: deve recuperar campaign do anúncio A')
      assert.equal(visit2.utmTrack.utms.content, 'video_a', 'Visita 2 direta: deve recuperar content do anúncio A')

      const decoratedLinkV2 = String(dom2[0]?.attrs['href'] || '')
      assert.ok(decoratedLinkV2.includes('utm_source=facebook'), 'Checkout visita direta: decorado com utm_source de A')
      assert.ok(decoratedLinkV2.includes('utm_campaign=blackfriday'), 'Checkout visita direta: decorado com utm_campaign de A')
      assert.ok(decoratedLinkV2.includes(`_utmt_sid=${sessionIdV2}`), 'Checkout visita direta: decorado com a nova sessionId')

      await prisma.trackingSession.create({
        data: {
          sessionId: sessionIdV2,
          visitorId,
          workspaceId: testWorkspaceId,
          utmSource: visit2.utmTrack.utms.source,
          utmCampaign: visit2.utmTrack.utms.campaign,
          utmMedium: visit2.utmTrack.utms.medium,
          utmContent: visit2.utmTrack.utms.content,
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      const sessions = await prisma.trackingSession.findMany({
        where: { visitorId }
      })
      assert.equal(sessions.length, 2, 'Histórico preservado: o banco deve conter as 2 sessões distintas do visitante')

      const saleResult1 = await upsertSale({
        workspaceId: testWorkspaceId,
        platform: 'kiwify',
        externalId: `RET_DIRECT_SALE_${Date.now()}`,
        status: 'approved',
        grossAmount: 197,
        netAmount: 180,
        currency: 'BRL',
        customerEmail: 'comprador.direto@exemplo.com',
        sessionId: sessionIdV2,
        orderedAt: new Date()
      })

      assert.equal(saleResult1.utmSource, 'facebook', 'Venda direta após anúncio A: herda utmSource da sessão resolvida')
      assert.equal(saleResult1.utmCampaign, 'blackfriday', 'Venda direta após anúncio A: herda utmCampaign da sessão resolvida')

      const attribution1 = await attemptAttribution(saleResult1.id)
      assert.ok(attribution1, 'Registro de atribuição gerado')
      assert.equal(attribution1.matchedBy, 'session', 'Atribuído diretamente pelo sessionId')
      assert.equal(attribution1.confidence, 1.0, 'Confiança máxima no match por sessão exata')
      assert.equal(attribution1.utmCampaign, 'blackfriday', 'Atribuição vinculada à campanha A')

      // -------------------------------------------------------------------------
      // CENÁRIO 2: A -> B -> Compra (Mesma Aba, mesmo sessionStorage e Endpoint Real)
      // -------------------------------------------------------------------------
      // Visita 1 (Campanha A)
      const domA = [
        { tag: 'a', attrs: { href: 'https://pay.kiwify.com.br/checkout_a' } }
      ]
      const visitA = runTrackerInVm({
        url: 'https://meusite.com.br/?utm_source=facebook&utm_campaign=ad_a&utm_content=video1',
        domElements: domA
      })
      assert.equal(visitA.utmTrack.utms.campaign, 'ad_a')
      const sessIdA = visitA.utmTrack.sessionId

      // Chamar endpoint real /api/tracking/session com os dados da visita A
      const rawBeaconA = visitA.sentBeacons[0]?.rawText || visitA.sentFetches[0]?.data
      const parsedBeaconA = typeof rawBeaconA === 'string' && rawBeaconA ? JSON.parse(rawBeaconA) : {}
      const reqA = new Request('https://track.test/api/tracking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsedBeaconA, workspaceId: testWorkspaceId })
      })
      const resA = await handleSessionPost(reqA)
      assert.equal(resA.status, 200, 'Endpoint real de sessão gravou sessão A com sucesso')

      const dbSessA = await prisma.trackingSession.findUnique({
        where: { sessionId: sessIdA }
      })
      assert.ok(dbSessA, 'Sessão A criada no banco')
      assert.equal(dbSessA.utmCampaign, 'ad_a', 'Sessão A gravada com campanha ad_a')

      // Visita 2 (Campanha B) NA MESMA ABA:
      // Passa o MESMO sessionStorageData contendo o _utmt_sid e _utmt_utm da visita A!
      const domB = [
        { tag: 'a', attrs: { href: 'https://pay.kiwify.com.br/checkout_b' } }
      ]
      const visitB = runTrackerInVm({
        url: 'https://meusite.com.br/?utm_source=google&utm_campaign=ad_b&utm_medium=cpc',
        localStorageData: visitA.mockStorage,
        sessionStorageData: visitA.mockSession, // Mesma aba! sessionStorage preservado
        domElements: domB
      })

      // O tracker DEVE detectar a troca de campanha e gerar uma NOVA sessão para B
      assert.equal(visitB.utmTrack.visitorId, visitA.utmTrack.visitorId, 'Mesmo visitante persistente')
      assert.notEqual(visitB.utmTrack.sessionId, sessIdA, 'Troca de campanha na mesma aba DEVE gerar novo sessionId')
      const sessIdB = visitB.utmTrack.sessionId

      assert.equal(visitB.utmTrack.utms.source, 'google', 'Visita B: source deve ser google')
      assert.equal(visitB.utmTrack.utms.campaign, 'ad_b', 'Visita B: campaign deve ser ad_b')
      assert.equal(visitB.utmTrack.utms.medium, 'cpc', 'Visita B: medium deve ser cpc')
      assert.equal(visitB.utmTrack.utms.content, null, 'Visita B: content deve ser null (NÃO herda video1 de A)')

      // Chamar endpoint real /api/tracking/session para a sessão B
      const rawBeaconB = visitB.sentBeacons[0]?.rawText || visitB.sentFetches[0]?.data
      const parsedBeaconB = typeof rawBeaconB === 'string' && rawBeaconB ? JSON.parse(rawBeaconB) : {}
      const reqB = new Request('https://track.test/api/tracking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsedBeaconB, workspaceId: testWorkspaceId })
      })
      const resB = await handleSessionPost(reqB)
      assert.equal(resB.status, 200, 'Endpoint real de sessão gravou sessão B com sucesso')

      // Verificar que o banco preservou AMBAS as sessões com suas respectivas origens intactas!
      const dbSessA_after = await prisma.trackingSession.findUnique({
        where: { sessionId: sessIdA }
      })
      assert.equal(dbSessA_after?.utmCampaign, 'ad_a', 'Histórico de A preservado no banco (não foi sobrescrito por B)')

      const dbSessB = await prisma.trackingSession.findUnique({
        where: { sessionId: sessIdB }
      })
      assert.equal(dbSessB?.utmCampaign, 'ad_b', 'Sessão B gravada no banco com ad_b')

      // Verificar link de checkout em B decorado com novo sessionId de B
      const decoratedLinkB = String(domB[0]?.attrs['href'] || '')
      assert.ok(decoratedLinkB.includes(`_utmt_sid=${sessIdB}`), 'Checkout B decorado com a nova sessionId de B')
      assert.ok(decoratedLinkB.includes('utm_source=google'), 'Checkout B tem utm_source=google')
      assert.ok(decoratedLinkB.includes('utm_campaign=ad_b'), 'Checkout B tem utm_campaign=ad_b')
      assert.ok(!decoratedLinkB.includes('video1'), 'Checkout B NÃO deve conter utm_content=video1')

      // Simular compra via webhook trazendo APENAS o sessionId de B (sem UTMs no payload do webhook)
      const saleResultB = await upsertSale({
        workspaceId: testWorkspaceId,
        platform: 'kiwify',
        externalId: `SALE_B_SAMETAB_${Date.now()}`,
        status: 'approved',
        grossAmount: 297,
        netAmount: 270,
        currency: 'BRL',
        customerEmail: 'comprador.b@exemplo.com',
        sessionId: sessIdB, // Somente o sessionId retornado pelo checkout decorado!
        orderedAt: new Date()
      })

      // upsertSale recupera B (e não A!) a partir da sessão correta no mesmo workspace
      assert.equal(saleResultB.utmCampaign, 'ad_b', 'Venda deve recuperar ad_b da nova sessão e NÃO ad_a')
      assert.equal(saleResultB.utmSource, 'google')

      const attributionB = await attemptAttribution(saleResultB.id)
      assert.ok(attributionB, 'Atribuição gerada com sucesso')
      assert.equal(attributionB.matchedBy, 'session')
      assert.equal(attributionB.confidence, 1.0)
      assert.equal(attributionB.utmCampaign, 'ad_b', 'Atribuído à campanha B')

      // -------------------------------------------------------------------------
      // CENÁRIO 2.1: Isolamento estrito de Workspace em upsertSale e attemptAttribution
      // -------------------------------------------------------------------------
      const foreignWs = await prisma.workspace.create({
        data: { name: 'Foreign Workspace', slug: `foreign-${Date.now()}` }
      })
      const foreignSessId = `foreign_sess_${Date.now()}`
      await prisma.trackingSession.create({
        data: {
          sessionId: foreignSessId,
          workspaceId: foreignWs.id,
          utmSource: 'foreign_source',
          utmCampaign: 'foreign_campaign',
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      // Venda criada no testWorkspaceId tentando referenciar a foreignSessId de outro workspace
      const crossSale = await upsertSale({
        workspaceId: testWorkspaceId,
        platform: 'kiwify',
        externalId: `CROSS_SALE_${Date.now()}`,
        status: 'approved',
        grossAmount: 99,
        netAmount: 90,
        currency: 'BRL',
        sessionId: foreignSessId,
        orderedAt: new Date()
      })

      // Não deve herdar os dados da sessão do outro workspace
      assert.ok(!crossSale.utmCampaign, 'upsertSale NÃO deve adotar sessão de outro workspace')
      const crossAttribution = await attemptAttribution(crossSale.id)
      assert.equal(crossAttribution, null, 'attemptAttribution NÃO deve atribuir a sessão de outro workspace')

      // Limpar foreignWs
      await prisma.trackingSession.deleteMany({ where: { workspaceId: foreignWs.id } })
      await prisma.sale.deleteMany({ where: { workspaceId: foreignWs.id } })
      await prisma.workspace.delete({ where: { id: foreignWs.id } })

      // -------------------------------------------------------------------------
      // CENÁRIO 3: Campanha expirada (> 30 dias) -> Retorno Direto
      // -------------------------------------------------------------------------
      const expiredTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000
      const expiredStorage = {
        '_utmt_campaign': JSON.stringify({
          utms: { source: 'facebook', campaign: 'antiga_31_dias', medium: 'cpc' },
          timestamp: expiredTimestamp,
          ttlDays: 30
        }),
        '_utmt_vid': 'persistent_vid_123'
      }

      const domExp = [
        { tag: 'a', attrs: { href: 'https://pay.kiwify.com.br/checkout_exp' } }
      ]

      const visitExp = runTrackerInVm({
        url: 'https://meusite.com.br/promo',
        localStorageData: expiredStorage,
        domElements: domExp
      })

      assert.equal(visitExp.utmTrack.utms.source, null, 'Campanha expirada: source deve ser null')
      assert.equal(visitExp.utmTrack.utms.campaign, null, 'Campanha expirada: campaign deve ser null')
      assert.equal(visitExp.mockStorage['_utmt_campaign'], undefined, 'Campanha expirada deve ser removida do storage')

      const decoratedLinkExp = String(domExp[0]?.attrs['href'] || '')
      assert.ok(!decoratedLinkExp.includes('antiga_31_dias'), 'Checkout NÃO deve receber UTMs da campanha expirada')

      // -------------------------------------------------------------------------
      // CENÁRIO 4: Nova campanha com UTMs incompletas sem herdar campos da anterior
      // -------------------------------------------------------------------------
      const visitAlpha = runTrackerInVm({
        url: 'https://meusite.com.br/?utm_source=meta&utm_campaign=black_friday&utm_content=banner_azul&utm_term=tenis_corrida'
      })
      assert.equal(visitAlpha.utmTrack.utms.content, 'banner_azul')
      assert.equal(visitAlpha.utmTrack.utms.term, 'tenis_corrida')

      const visitBeta = runTrackerInVm({
        url: 'https://meusite.com.br/?utm_source=tiktok&utm_campaign=natal_ofertas',
        localStorageData: visitAlpha.mockStorage
      })
      assert.equal(visitBeta.utmTrack.utms.source, 'tiktok')
      assert.equal(visitBeta.utmTrack.utms.campaign, 'natal_ofertas')
      assert.equal(visitBeta.utmTrack.utms.content, null, 'Beta NÃO deve herdar banner_azul de Alpha')
      assert.equal(visitBeta.utmTrack.utms.term, null, 'Beta NÃO deve herdar tenis_corrida de Alpha')

      // -------------------------------------------------------------------------
      // CENÁRIO 5: Resiliência a Storage Indisponível / QuotaExceededError / JSON corrompido
      // -------------------------------------------------------------------------
      assert.doesNotThrow(() => {
        const visitQuota = runTrackerInVm({
          url: 'https://meusite.com.br/?utm_source=facebook&utm_campaign=resilience_test',
          throwOnLocalStorageSet: true
        })
        assert.equal(visitQuota.utmTrack.utms.campaign, 'resilience_test', 'Mesmo com erro de quota, utms resolvidas são preservadas')
      }, 'O tracker NÃO pode lançar erro não tratado se o localStorage falhar')

      assert.doesNotThrow(() => {
        const visitCorrupt = runTrackerInVm({
          url: 'https://meusite.com.br/landing',
          localStorageData: {
            '_utmt_campaign': '{bad_json_not_valid_syntax...'
          }
        })
        assert.equal(visitCorrupt.utmTrack.utms.campaign, null, 'JSON corrompido é tratado com segurança sem crash')
      }, 'O tracker NÃO pode quebrar se o localStorage contiver dados inválidos')

      // -------------------------------------------------------------------------
      // CENÁRIO 6: TTL configurável via atributo data-campaign-ttl-days
      // -------------------------------------------------------------------------
      const visitCustomTtl = runTrackerInVm({
        url: 'https://meusite.com.br/?utm_source=google&utm_campaign=short_campaign',
        scriptAttrs: {
          'data-campaign-ttl-days': '7'
        }
      })
      assert.equal(visitCustomTtl.utmTrack.campaignTtlDays, 7, 'Configura TTL customizado de 7 dias')
      const storedCustom = JSON.parse(visitCustomTtl.mockStorage['_utmt_campaign'])
      assert.equal(storedCustom.ttlDays, 7, 'Payload gravado reflete o TTL customizado de 7 dias')

    } finally {
      // Limpeza de dados gerados no teste
      await prisma.attributionRecord.deleteMany({ where: { workspaceId: testWorkspaceId } }).catch(() => {})
      await prisma.sale.deleteMany({ where: { workspaceId: testWorkspaceId } }).catch(() => {})
      await prisma.trackingSession.deleteMany({ where: { workspaceId: testWorkspaceId } }).catch(() => {})
    }
  })
})
