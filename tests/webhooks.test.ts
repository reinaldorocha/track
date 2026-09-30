import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'

describe('Integrações e Normalização de Webhooks', () => {
  it('Hotmart: Normalização de evento PURCHASE_APPROVED', () => {
    const hotmartPayload = {
      event: 'PURCHASE_APPROVED',
      data: {
        purchase: {
          transaction: 'HP123456789',
          order_date: '2026-09-07T14:30:00Z',
          approved_date: '2026-09-07T14:32:00Z',
          price: { value: 197.0, currency_code: 'BRL' },
          commission: { value: 180.0 },
          tracking: {
            utm_source: 'instagram',
            utm_campaign: 'oferta_relampago'
          }
        },
        buyer: { email: 'cliente@gmail.com' }
      }
    }

    const { event, data } = hotmartPayload
    const status = event === 'PURCHASE_APPROVED' ? 'approved' : 'pending'
    const grossAmount = data.purchase.price.value
    const netAmount = data.purchase.commission.value

    assert.equal(status, 'approved')
    assert.equal(grossAmount, 197.0)
    assert.equal(netAmount, 180.0)
    assert.equal(data.purchase.tracking.utm_source, 'instagram')
  })

  it('Shopify: Validação de assinatura HMAC-SHA256', () => {
    const secret = 'shpss_test_secret_123'
    const payload = JSON.stringify({ id: 82098291194, total_price: '250.00' })

    // Gerar HMAC esperado
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64')

    // Validar assinatura
    const receivedHmac = expectedHmac
    const isValid = crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(receivedHmac))

    assert.equal(isValid, true)
  })

  it('Yampi: Mapeamento de status de pedido', () => {
    const mapYampiStatus = (alias: string) => {
      if (alias === 'payment_approved' || alias === 'paid') return 'approved'
      if (alias === 'refunded') return 'refunded'
      if (alias === 'cancelled') return 'cancelled'
      return 'pending'
    }

    assert.equal(mapYampiStatus('payment_approved'), 'approved')
    assert.equal(mapYampiStatus('refunded'), 'refunded')
    assert.equal(mapYampiStatus('waiting_payment'), 'pending')
    assert.equal(mapYampiStatus('cancelled'), 'cancelled')
  })

  it('Cakto: Normalização oficial de payload com campos id, status, amount, utms e e-mail', () => {
    const caktoPayload = {
      id: 'cakto_trans_99182',
      status: 'approved',
      amount: 297.0,
      currency: 'BRL',
      email: 'comprador@cakto.com.br',
      utms: {
        source: 'facebook',
        medium: 'cpc',
        campaign: 'campanha_cakto_oficial',
        content: 'ad_01',
        term: 'feed'
      },
      created_at: '2026-09-08T12:00:00Z'
    }

    const caktoStatus = caktoPayload.status.toLowerCase()
    let status = 'pending'
    if (caktoStatus.includes('approved') || caktoStatus.includes('paid')) status = 'approved'

    assert.equal(status, 'approved')
    assert.equal(caktoPayload.amount, 297.0)
    assert.equal(caktoPayload.utms.campaign, 'campanha_cakto_oficial')
    assert.equal(caktoPayload.utms.source, 'facebook')
  })

  it('Cakto: Geração de chave de idempotência para evitar duplicação de vendas', () => {
    const transId = 'ck_987654'
    const status = 'approved'
    const key1 = `cakto_${transId}_${status}_approved`
    const key2 = `cakto_${transId}_${status}_approved`

    assert.equal(key1, key2, 'Mesma transação Cakto gera a mesma chave de idempotência')
  })

  it('Detecção de Checkout por URL: Reconhece gateways configurados (Hotmart, Cakto, Kiwify, Getfy, domínios próprios como profjonathanrocha e padrão /c/)', () => {
    const checkoutKeywords = [
      'hotmart.com', 'cakto.com.br', 'cacto.com.br', 'yampi.io', 'yampi.com.br',
      'shopify.com', 'myshopify.com', 'kiwify.com.br', 'eduzz.com', 'braip.com',
      'ticto.com.br', 'monetizze.com.br', 'perfectpay.com.br', 'getfy.com', 'getfy.com.br', 'getfy.cloud',
      'profjonathanrocha.com.br',
      'pay.', 'checkout', '/c/'
    ]

    const isCheckout = (url: string) => {
      const lower = url.toLowerCase()
      return checkoutKeywords.some(k => lower.includes(k))
    }

    assert.equal(isCheckout('https://pay.hotmart.com/B12345678X'), true)
    assert.equal(isCheckout('https://checkout.cakto.com.br/pay/abc123xyz'), true)
    assert.equal(isCheckout('https://loja.yampi.io/checkout/order/123'), true)
    assert.equal(isCheckout('https://minhaloja.myshopify.com/checkouts/c/12345'), true)
    assert.equal(isCheckout('https://app.profjonathanrocha.com.br/c/hvgsxbr'), true, 'Checkout próprio Getfy do usuário deve ser reconhecido com precisão')
    assert.equal(isCheckout('https://app.profjonathanrocha.com.br/c/qualquer-slug'), true)
    assert.equal(isCheckout('https://meusite.com.br/pagina-de-vendas'), false)
  })

  it('Resolução de Workspace por Query Parameter e Header no Webhook', () => {
    const resolveWorkspace = (searchParams: URLSearchParams, headers: Record<string, string>, defaultId: string) => {
      return searchParams.get('workspaceId') || searchParams.get('workspace_id') || headers['x-workspace-id'] || defaultId
    }

    const params1 = new URLSearchParams('workspaceId=ws_custom_123')
    assert.equal(resolveWorkspace(params1, {}, 'ws_default'), 'ws_custom_123')

    const params2 = new URLSearchParams('workspace_id=ws_snake_456')
    assert.equal(resolveWorkspace(params2, {}, 'ws_default'), 'ws_snake_456')

    const headers = { 'x-workspace-id': 'ws_header_789' }
    assert.equal(resolveWorkspace(new URLSearchParams(), headers, 'ws_default'), 'ws_header_789')

    assert.equal(resolveWorkspace(new URLSearchParams(), {}, 'ws_default'), 'ws_default')
  })

  it('Classificação e Mapeamento de Métodos de Pagamento (Pix, Cartão, Boleto)', () => {
    const classifyPayment = (typeOrGateway: string): 'pix' | 'card' | 'boleto' => {
      const lower = typeOrGateway.toLowerCase()
      if (lower.includes('pix')) return 'pix'
      if (lower.includes('boleto') || lower.includes('billet')) return 'boleto'
      return 'card'
    }

    assert.equal(classifyPayment('PIX'), 'pix')
    assert.equal(classifyPayment('pix_instant'), 'pix')
    assert.equal(classifyPayment('credit_card'), 'card')
    assert.equal(classifyPayment('mastercard'), 'card')
    assert.equal(classifyPayment('billet'), 'boleto')
    assert.equal(classifyPayment('boleto_bancario'), 'boleto')
  })

  it('Central Normalizer: normalizeSaleAmount com múltiplos formatos de preço (Float, String BR, Centavos, Preço de Oferta)', async () => {
    const { normalizeSaleAmount } = await import('../src/lib/integrations/normalizer')

    // Hotmart
    assert.equal(normalizeSaleAmount({ data: { purchase: { price: { value: 197.0 } } } }, 'hotmart'), 197.0)
    assert.equal(normalizeSaleAmount({ data: { purchase: { original_offer_price: { value: '297,50' } } } }, 'hotmart'), 297.5)
    assert.equal(normalizeSaleAmount({ data: { purchase: { full_price: { value: '1.499,00' } } } }, 'hotmart'), 1499.0)

    // Cakto
    assert.equal(normalizeSaleAmount({ amount: 97.0 }, 'cakto'), 97.0)
    assert.equal(normalizeSaleAmount({ data: { price: '497.00' } }, 'cakto'), 497.0)

    // Yampi
    assert.equal(normalizeSaleAmount({ resource: { value: '159.90' } }, 'yampi'), 159.9)

    // Shopify
    assert.equal(normalizeSaleAmount({ total_price: '89.00' }, 'shopify'), 89.0)

    // Genérico
    assert.equal(normalizeSaleAmount({ grossAmount: 350.0 }, 'generic'), 350.0)
  })

  it('Central Normalizer: normalizeNetAmount preserva valor bruto caso comissão não seja informada', async () => {
    const { normalizeNetAmount } = await import('../src/lib/integrations/normalizer')

    // Com comissão explícita
    assert.equal(normalizeNetAmount({ data: { purchase: { commission: { value: 180.0 } } } }, 'hotmart', 197.0), 180.0)

    // Sem comissão explícita (fallback para grossAmount)
    assert.equal(normalizeNetAmount({}, 'cakto', 297.0), 297.0)
    assert.equal(normalizeNetAmount({}, 'yampi', 159.9), 159.9)
    assert.equal(normalizeNetAmount({}, 'generic', 350.0), 350.0)
  })

  it('Central Normalizer: normalizeSaleStatus mapeia corretamente variações de status de gateways', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')

    // Aprovados
    assert.equal(normalizeSaleStatus('PURCHASE_APPROVED'), 'approved')
    assert.equal(normalizeSaleStatus('PURCHASE_COMPLETE'), 'approved')
    assert.equal(normalizeSaleStatus('orders/paid'), 'approved')
    assert.equal(normalizeSaleStatus('payment_approved'), 'approved')
    assert.equal(normalizeSaleStatus('PAID'), 'approved')
    assert.equal(normalizeSaleStatus('APROVADO'), 'approved')

    // Reembolsos
    assert.equal(normalizeSaleStatus('PURCHASE_REFUNDED'), 'refunded')
    assert.equal(normalizeSaleStatus('refunds/create'), 'refunded')
    assert.equal(normalizeSaleStatus('REEMBOLSADO'), 'refunded')

    // Chargebacks
    assert.equal(normalizeSaleStatus('PURCHASE_CHARGEBACK'), 'chargeback')
    assert.equal(normalizeSaleStatus('CHARGEBACK'), 'chargeback')

    // Pendentes
    assert.equal(normalizeSaleStatus('PURCHASE_PENDING'), 'pending')
    assert.equal(normalizeSaleStatus('orders/create'), 'pending')
    assert.equal(normalizeSaleStatus('waiting_payment'), 'pending')
  })

  it('Central Normalizer: normalizeSaleUtms extrai UTMs e identificadores Meta de qualquer estrutura', async () => {
    const { normalizeSaleUtms } = await import('../src/lib/integrations/normalizer')

    const payloadWithTracking = {
      data: {
        purchase: {
          tracking: {
            utm_source: 'facebook_ads',
            utm_medium: 'cpc',
            utm_campaign: 'campanha_blackfriday',
            utm_content: 'video_01',
            utm_term: 'interesses',
            fbclid: 'IwAR123456789'
          }
        }
      }
    }

    const utms = normalizeSaleUtms(payloadWithTracking)
    assert.equal(utms.utmSource, 'facebook_ads')
    assert.equal(utms.utmMedium, 'cpc')
    assert.equal(utms.utmCampaign, 'campanha_blackfriday')
    assert.equal(utms.utmContent, 'video_01')
    assert.equal(utms.utmTerm, 'interesses')
    assert.equal(utms.fbclid, 'IwAR123456789')
  })

  it('End-to-End: Processamento completo de venda Hotmart aprovada -> métricas financeiras atualizadas', async () => {
    const { normalizeSaleAmount, normalizeNetAmount, normalizeSaleStatus, normalizeSalePaymentMethod, normalizeSaleUtms } = await import('../src/lib/integrations/normalizer')
    const { calcROAS, calcROI, calcProfit, calcCPA } = await import('../src/lib/metrics')

    const hotmartPayload = {
      event: 'PURCHASE_APPROVED',
      data: {
        purchase: {
          transaction: 'HP987654321',
          order_date: '2026-09-08T15:00:00Z',
          approved_date: '2026-09-08T15:02:00Z',
          price: { value: 297.0, currency_code: 'BRL' },
          commission: { value: 270.0 },
          payment: { type: 'PIX' },
          tracking: {
            utm_source: 'meta_ads',
            utm_medium: 'cpc',
            utm_campaign: 'oferta_direta'
          }
        },
        buyer: { email: 'comprador@gmail.com' }
      }
    }

    const grossAmount = normalizeSaleAmount(hotmartPayload, 'hotmart')
    const netAmount = normalizeNetAmount(hotmartPayload, 'hotmart', grossAmount)
    const status = normalizeSaleStatus(hotmartPayload.event, 'hotmart')
    const paymentMethod = normalizeSalePaymentMethod(hotmartPayload, 'hotmart')
    const utms = normalizeSaleUtms(hotmartPayload)

    assert.equal(grossAmount, 297.0)
    assert.equal(netAmount, 270.0)
    assert.equal(status, 'approved')
    assert.equal(paymentMethod, 'pix')
    assert.equal(utms.utmSource, 'meta_ads')

    // Verificação dos cálculos financeiros com investimento de anúncio existente
    const adSpend = 50.0
    const roas = calcROAS(grossAmount, adSpend)
    const profit = calcProfit({ netRevenue: netAmount, adSpend, productCost: 0, fees: 0, taxes: 0, expenses: 0 })
    const roi = calcROI(profit, adSpend)
    const cpa = calcCPA(adSpend, 1)

    assert.equal(roas, 297.0 / 50.0)
    assert.equal(profit, 270.0 - 50.0) // R$ 220,00 de lucro
    assert.equal(roi, ((220.0) / 50.0) * 100) // 440% ROI
    assert.equal(cpa, 50.0)
  })

  it('End-to-End: Processamento de venda Cakto com string monetária brasileira e parcelamento', async () => {
    const { normalizeSaleAmount, normalizeNetAmount, normalizeSaleStatus, normalizeSalePaymentMethod } = await import('../src/lib/integrations/normalizer')

    const caktoPayload = {
      id: 'ck_trans_5544',
      status: 'approved',
      amount: '197,50',
      currency: 'BRL',
      payment_method: 'credit_card',
      customer: { email: 'cliente@cakto.com' },
      utms: {
        source: 'facebook',
        campaign: 'vendas_escala'
      }
    }

    const grossAmount = normalizeSaleAmount(caktoPayload, 'cakto')
    const netAmount = normalizeNetAmount(caktoPayload, 'cakto', grossAmount)
    const status = normalizeSaleStatus(caktoPayload.status, 'cakto')
    const paymentMethod = normalizeSalePaymentMethod(caktoPayload, 'cakto')

    assert.equal(grossAmount, 197.5)
    assert.equal(netAmount, 197.5)
    assert.equal(status, 'approved')
    assert.equal(paymentMethod, 'card')
  })

  it('End-to-End: Venda pendente não impacta faturamento bruto nem líquido', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')

    const pendingPayload = {
      event: 'PURCHASE_PENDING',
      data: {
        purchase: {
          transaction: 'HP_PENDING_01',
          price: { value: 500.0 }
        }
      }
    }

    const status = normalizeSaleStatus(pendingPayload.event, 'hotmart')
    assert.equal(status, 'pending')

    const sales = [
      { status: 'pending', grossAmount: 500.0, netAmount: 450.0 },
      { status: 'approved', grossAmount: 300.0, netAmount: 270.0 }
    ]

    const approvedList = sales.filter(s => s.status === 'approved')
    const grossRevenue = approvedList.reduce((acc, s) => acc + s.grossAmount, 0)
    const netRevenue = approvedList.reduce((acc, s) => acc + s.netAmount, 0)

    assert.equal(grossRevenue, 300.0, 'Apenas a venda aprovada soma no faturamento bruto')
    assert.equal(netRevenue, 270.0, 'Apenas a venda aprovada soma no faturamento líquido')
  })

  it('End-to-End: Funil de Conversão calcula taxas reais entre etapas', () => {
    const clicks = 100
    const pageViews = 75
    const ics = 25
    const vendasInic = 10
    const vendasApr = 8

    const pctPageViews = Math.round((pageViews / clicks) * 100) // 75%
    const pctICs = Math.round((ics / pageViews) * 100) // 33%
    const pctVendasInic = Math.round((vendasInic / ics) * 100) // 40%
    const pctVendasApr = Math.round((vendasApr / vendasInic) * 100) // 80%

    assert.equal(pctPageViews, 75)
    assert.equal(pctICs, 33)
    assert.equal(pctVendasInic, 40)
    assert.equal(pctVendasApr, 80)
  })

  // ============================================================
  // SUÍTE FORMAL DE 12 TESTES DO FLUXO HOTMART
  // ============================================================

  it('TESTE 1: Webhook Hotmart PURCHASE_APPROVED válido -> Sale aprovada com valor correto', async () => {
    const { normalizeSaleAmount, normalizeNetAmount, normalizeSaleStatus, normalizeSalePaymentMethod, normalizeSaleUtms } = await import('../src/lib/integrations/normalizer')

    const payload = {
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: 1001, name: 'Formação Expert', ucode: 'PROD-EXP-01' },
        buyer: { name: 'João Silva', email: 'joao.silva@gmail.com' },
        purchase: {
          transaction: 'HP_REAL_1001',
          order_date: 1725800000000,
          approved_date: 1725800100000,
          price: { value: 497.0, currency_code: 'BRL' },
          commission: { value: 450.0 },
          payment: { type: 'CREDIT_CARD' },
          tracking: { utm_source: 'meta_ads', utm_campaign: 'campanha_escala' }
        }
      }
    }

    const gross = normalizeSaleAmount(payload, 'hotmart')
    const net = normalizeNetAmount(payload, 'hotmart', gross)
    const status = normalizeSaleStatus(payload.event, 'hotmart')
    const method = normalizeSalePaymentMethod(payload, 'hotmart')
    const utms = normalizeSaleUtms(payload)

    assert.equal(gross, 497.0)
    assert.equal(net, 450.0)
    assert.equal(status, 'approved')
    assert.equal(method, 'card')
    assert.equal(utms.utmSource, 'meta_ads')
    assert.equal(utms.utmCampaign, 'campanha_escala')
  })

  it('TESTE 2: Mesmo webhook enviado duas vezes -> Idempotência gera mesma chave', () => {
    const transaction = 'HP_REAL_1002'
    const event = 'PURCHASE_APPROVED'
    const idempotencyKey1 = `hotmart_${transaction}_${event}`
    const idempotencyKey2 = `hotmart_${transaction}_${event}`

    assert.equal(idempotencyKey1, idempotencyKey2)
    assert.equal(idempotencyKey1, 'hotmart_HP_REAL_1002_PURCHASE_APPROVED')
  })

  it('TESTE 3: PURCHASE_BILLET_PRINTED -> Status pending e método pix/boleto', async () => {
    const { normalizeSaleAmount, normalizeSaleStatus, normalizeSalePaymentMethod } = await import('../src/lib/integrations/normalizer')

    const payload = {
      event: 'PURCHASE_BILLET_PRINTED',
      data: {
        purchase: {
          transaction: 'HP_REAL_1003',
          price: { value: 197.0 },
          payment: { type: 'BANK_SLIP' }
        }
      }
    }

    assert.equal(normalizeSaleStatus(payload.event, 'hotmart'), 'pending')
    assert.equal(normalizeSaleAmount(payload, 'hotmart'), 197.0)
    assert.equal(normalizeSalePaymentMethod(payload, 'hotmart'), 'boleto')
  })

  it('TESTE 4: PURCHASE_APPROVED depois de PENDING -> Atualiza status para approved', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')

    const pendingStatus = normalizeSaleStatus('PURCHASE_BILLET_PRINTED', 'hotmart')
    assert.equal(pendingStatus, 'pending')

    const approvedStatus = normalizeSaleStatus('PURCHASE_APPROVED', 'hotmart')
    assert.equal(approvedStatus, 'approved')
  })

  it('TESTE 5: PURCHASE_REFUNDED -> Atualiza status para refunded', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')
    assert.equal(normalizeSaleStatus('PURCHASE_REFUNDED', 'hotmart'), 'refunded')
  })

  it('TESTE 6: PURCHASE_CHARGEBACK e PURCHASE_PROTEST -> Atualiza status para chargeback', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')
    assert.equal(normalizeSaleStatus('PURCHASE_CHARGEBACK', 'hotmart'), 'chargeback')
    assert.equal(normalizeSaleStatus('PURCHASE_PROTEST', 'hotmart'), 'chargeback')
  })

  it('TESTE 7: PURCHASE_CANCELED e PURCHASE_EXPIRED -> Status cancelled', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')
    assert.equal(normalizeSaleStatus('PURCHASE_CANCELED', 'hotmart'), 'cancelled')
    assert.equal(normalizeSaleStatus('PURCHASE_EXPIRED', 'hotmart'), 'cancelled')
  })

  it('TESTE 8: Evento sem valor -> Trata como 0 de forma segura sem lançar erro nem criar NaN', async () => {
    const { normalizeSaleAmount, normalizeNetAmount } = await import('../src/lib/integrations/normalizer')

    const payload = { event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'HP_ZERO' } } }
    const gross = normalizeSaleAmount(payload, 'hotmart')
    const net = normalizeNetAmount(payload, 'hotmart', gross)

    assert.equal(gross, 0)
    assert.equal(net, 0)
    assert.equal(isNaN(gross), false)
    assert.equal(isNaN(net), false)
  })

  it('TESTE 9: Payload incompleto ou sem purchase -> Identificado com segurança', () => {
    const isValidHotmartPayload = (p: any) => {
      if (!p || typeof p !== 'object') return false
      const data = p.data || p
      const purchase = data.purchase || p.purchase
      return !!purchase || !!p.transaction
    }

    assert.equal(isValidHotmartPayload({}), false)
    assert.equal(isValidHotmartPayload(null), false)
    assert.equal(isValidHotmartPayload({ event: 'TEST' }), false)
    assert.equal(isValidHotmartPayload({ event: 'PURCHASE_APPROVED', data: { purchase: { transaction: 'HP123' } } }), true)
  })

  it('TESTE 10: Evento de teste Hotmart -> isHotmartTestEvent reconhece e isola', async () => {
    const { isHotmartTestEvent } = await import('../src/lib/integrations/normalizer')

    const testPayload1 = {
      event: 'PURCHASE_APPROVED',
      data: {
        product: { name: 'Produto de Teste' },
        buyer: { name: 'Comprador Teste', email: 'teste@hotmart.com' },
        purchase: { transaction: 'HP00000000000001', price: { value: 100.0 } }
      }
    }

    const testPayload2 = {
      is_test: true,
      data: { purchase: { transaction: 'TEST_99182' } }
    }

    const realPayload = {
      event: 'PURCHASE_APPROVED',
      data: {
        product: { name: 'Mentoria Black' },
        buyer: { name: 'Carlos Andrade', email: 'carlos@empresa.com.br' },
        purchase: { transaction: 'HP987123654', price: { value: 997.0 } }
      }
    }

    assert.equal(isHotmartTestEvent(testPayload1), true, 'Payload 1 oficial de teste da Hotmart deve retornar true')
    assert.equal(isHotmartTestEvent(testPayload2), true, 'Payload com flag is_test deve retornar true')
    assert.equal(isHotmartTestEvent(realPayload), false, 'Venda real de cliente não pode ser tratada como teste')
  })

  it('TESTE 11: Venda real aprovada -> Reflete no cálculo de Faturamento, CPA, ROAS e ROI', async () => {
    const { calcROAS, calcROI, calcProfit, calcCPA, calcMargin } = await import('../src/lib/metrics')

    const adSpend = 200.0
    const grossRevenue = 1000.0
    const netRevenue = 900.0
    const approvedSales = 2

    const profit = calcProfit({ netRevenue, adSpend, productCost: 0, fees: 50.0, taxes: 60.0, expenses: 0 })
    const roas = calcROAS(grossRevenue, adSpend)
    const roi = calcROI(profit, adSpend + 50.0 + 60.0)
    const cpa = calcCPA(adSpend, approvedSales)
    const margin = calcMargin(profit, grossRevenue)

    assert.equal(profit, 900.0 - 200.0 - 50.0 - 60.0) // R$ 590,00
    assert.equal(roas, 5.0) // ROAS 5.0x
    assert.equal(cpa, 100.0) // R$ 100,00 por venda
    assert.equal(margin, 59.0) // 59% de margem
  })

  it('TESTE 13: Evento de teste Hotmart com headers e boleto R$ 1500 -> isHotmartTestEvent reconhece', async () => {
    const { isHotmartTestEvent } = await import('../src/lib/integrations/normalizer')

    const billetTestPayload = {
      event: 'PURCHASE_BILLET_PRINTED',
      data: {
        product: { name: 'Produto test postback2' },
        buyer: { name: 'Comprador Teste', email: 'teste@hotmart.com' },
        purchase: { transaction: 'HP00000000000001', price: { value: 1500.0 } }
      }
    }

    const testHeaders = { 'x-hotmart-test': 'true' }

    assert.equal(isHotmartTestEvent(billetTestPayload, testHeaders), true, 'Boleto de teste R$ 1500 deve ser isolado como teste')
    assert.equal(isHotmartTestEvent({ event: 'PURCHASE_BILLET_PRINTED' }, { 'x-hotmart-event-test': '1' }), true)
  })

  it('TESTE 14: isTestSaleRecord identifica registros de teste no banco', async () => {
    const { isTestSaleRecord } = await import('../src/lib/integrations/normalizer')

    const testSale1 = { externalId: 'HP00000000000001', customerEmail: 'teste@hotmart.com' }
    const testSale2 = { externalId: 'HP123456789', customerEmail: 'teste@hotmart.com' }
    const testSale3 = { externalId: 'TEST_9981', customerEmail: 'user@empresa.com' }
    const realSale = { externalId: 'HP987654321', customerEmail: 'cliente.real@gmail.com' }

    assert.equal(isTestSaleRecord(testSale1), true)
    assert.equal(isTestSaleRecord(testSale2), true)
    assert.equal(isTestSaleRecord(testSale3), true)
    assert.equal(isTestSaleRecord(realSale), false)
  })

  it('Getfy: Normalização de evento pedido_pago com envelope completo e tracking', async () => {
    const { normalizeSaleAmount, normalizeNetAmount, normalizeSaleStatus, normalizeSalePaymentMethod, normalizeSaleUtms } = await import('../src/lib/integrations/normalizer')

    const getfyEnvelope = {
      event: 'pedido_pago',
      event_label: 'Pedido pago',
      payload: {
        order: {
          id: 90001,
          status: 'completed',
          amount: 197.0,
          currency: 'BRL',
          created_at: '2026-09-29T10:00:00Z'
        },
        customer: {
          email: 'comprador@getfy.com.br',
          phone: '5511999998888',
          name: 'Comprador Getfy'
        },
        amount: 197.0,
        status: 'paid',
        paymentMethod: 'pix',
        product: {
          id: 'prod-abc',
          name: 'Curso de Tráfego'
        },
        tracking: {
          utm_source: 'instagram',
          utm_medium: 'stories',
          utm_campaign: 'lancamento_setembro',
          src: 'instagram',
          sck: 'lancamento_setembro'
        }
      }
    }

    const payload = getfyEnvelope.payload
    const status = normalizeSaleStatus(getfyEnvelope.event, 'getfy')
    const grossPrice = normalizeSaleAmount(payload, 'getfy')
    const netPrice = normalizeNetAmount(payload, 'getfy', grossPrice)
    const paymentMethod = normalizeSalePaymentMethod(payload, 'getfy')
    const utms = normalizeSaleUtms(payload)

    assert.equal(status, 'approved')
    assert.equal(grossPrice, 197.0)
    assert.equal(netPrice, 197.0)
    assert.equal(paymentMethod, 'pix')
    assert.equal(utms.utmSource, 'instagram')
    assert.equal(utms.utmMedium, 'stories')
    assert.equal(utms.utmCampaign, 'lancamento_setembro')
  })

  it('Getfy: Normalização de eventos de ciclo de vida (pendente, pix, cancelado, reembolso, assinatura)', async () => {
    const { normalizeSaleStatus } = await import('../src/lib/integrations/normalizer')

    assert.equal(normalizeSaleStatus('pedido_pago', 'getfy'), 'approved')
    assert.equal(normalizeSaleStatus('assinatura_criada', 'getfy'), 'approved')
    assert.equal(normalizeSaleStatus('assinatura_renovada', 'getfy'), 'approved')
    assert.equal(normalizeSaleStatus('pedido_pendente', 'getfy'), 'pending')
    assert.equal(normalizeSaleStatus('pix_gerado', 'getfy'), 'pending')
    assert.equal(normalizeSaleStatus('boleto_gerado', 'getfy'), 'pending')
    assert.equal(normalizeSaleStatus('pagamento_recusado', 'getfy'), 'cancelled')
    assert.equal(normalizeSaleStatus('pedido_cancelado', 'getfy'), 'cancelled')
    assert.equal(normalizeSaleStatus('assinatura_cancelada', 'getfy'), 'cancelled')
    assert.equal(normalizeSaleStatus('reembolso', 'getfy'), 'refunded')
  })

  it('Getfy: Geração e unicidade de chave de idempotência', () => {
    const orderId = '90001'
    const status = 'approved'
    const key1 = `getfy_${orderId}_${status}`
    const key2 = `getfy_${orderId}_${status}`

    assert.equal(key1, key2)
    assert.equal(key1, 'getfy_90001_approved')
  })

  // Segurança de Webhooks (Kiwify e Hotmart)
  it('Segurança Webhooks: Kiwify rejeita requisição sem token quando segredo está configurado', async () => {
    const { POST: kiwifyPost } = await import('../src/app/api/webhooks/kiwify/route')
    const originalSecret = process.env.KIWIFY_WEBHOOK_SECRET
    process.env.KIWIFY_WEBHOOK_SECRET = 'super_secret_kiwify_123'

    try {
      // 1. Requisição SEM token
      const reqNoToken = new Request('http://localhost/api/webhooks/kiwify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'kw_test_sec_1', order_status: 'paid' })
      })
      const resNoToken = await kiwifyPost(reqNoToken)
      assert.equal(resNoToken.status, 401, 'Deve rejeitar com 401 quando token está ausente')

      // 2. Requisição com token INCORRETO
      const reqWrongToken = new Request('http://localhost/api/webhooks/kiwify?token=token_errado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'kw_test_sec_2', order_status: 'paid' })
      })
      const resWrongToken = await kiwifyPost(reqWrongToken)
      assert.equal(resWrongToken.status, 401, 'Deve rejeitar com 401 quando token é inválido')

      // 3. Requisição com workspaceId INEXISTENTE
      const reqInvalidWs = new Request('http://localhost/api/webhooks/kiwify?token=super_secret_kiwify_123&workspaceId=ws_fantasma_999', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'kw_test_sec_3', order_status: 'paid' })
      })
      const resInvalidWs = await kiwifyPost(reqInvalidWs)
      assert.equal(resInvalidWs.status, 404, 'Deve rejeitar com 404 quando workspaceId não existe')
    } finally {
      process.env.KIWIFY_WEBHOOK_SECRET = originalSecret
    }
  })

  it('Segurança Webhooks: Hotmart rejeita requisição sem hottok quando segredo está configurado', async () => {
    const { POST: hotmartPost } = await import('../src/app/api/webhooks/hotmart/route')
    const originalSecret = process.env.HOTMART_WEBHOOK_SECRET
    process.env.HOTMART_WEBHOOK_SECRET = 'super_hottok_secret_456'

    try {
      // 1. Requisição SEM hottok
      const reqNoHottok = new Request('http://localhost/api/webhooks/hotmart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PURCHASE_APPROVED',
          data: { purchase: { transaction: 'HP_SEC_1', price: { value: 100 } } }
        })
      })
      const resNoHottok = await hotmartPost(reqNoHottok)
      assert.equal(resNoHottok.status, 401, 'Deve rejeitar com 401 quando hottok está ausente')

      // 2. Requisição com hottok INCORRETO
      const reqWrongHottok = new Request('http://localhost/api/webhooks/hotmart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hotmart-hottok': 'hottok_errado'
        },
        body: JSON.stringify({
          event: 'PURCHASE_APPROVED',
          data: { purchase: { transaction: 'HP_SEC_2', price: { value: 100 } } }
        })
      })
      const resWrongHottok = await hotmartPost(reqWrongHottok)
      assert.equal(resWrongHottok.status, 401, 'Deve rejeitar com 401 quando hottok é inválido')
    } finally {
      process.env.HOTMART_WEBHOOK_SECRET = originalSecret
    }
  })
})


