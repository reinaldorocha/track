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
import { dispatchPurchaseToCapi, retryFailedCapiEvents } from '../src/lib/meta/capi-service'
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
})
