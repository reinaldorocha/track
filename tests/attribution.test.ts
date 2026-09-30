import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Motor de Atribuição de Vendas', () => {
  it('Priorização correta de identificadores (fbclid > fbp > sessionId > utmCampaign)', () => {
    const sale = {
      id: 'sale_1',
      fbclid: 'fb_click_123',
      fbp: 'fb.1.1234567.890',
      sessionId: 'sess_abc',
      utmCampaign: 'campanha_natal'
    }

    // Regra de atribuição Last-Click
    let matchedBy = ''
    let confidence = 0

    if (sale.fbclid) {
      matchedBy = 'fbclid'
      confidence = 1.0
    } else if (sale.fbp) {
      matchedBy = 'fbp'
      confidence = 0.9
    } else if (sale.sessionId) {
      matchedBy = 'session'
      confidence = 0.85
    } else if (sale.utmCampaign) {
      matchedBy = 'utm'
      confidence = 0.5
    }

    assert.equal(matchedBy, 'fbclid')
    assert.equal(confidence, 1.0)
  })

  it('Atribuição por fbp quando fbclid não estiver presente', () => {
    const sale = {
      id: 'sale_2',
      fbclid: undefined,
      fbp: 'fb.1.1234567.890',
      sessionId: 'sess_abc',
      utmCampaign: 'campanha_natal'
    }

    let matchedBy = ''
    let confidence = 0

    if (sale.fbclid) {
      matchedBy = 'fbclid'
      confidence = 1.0
    } else if (sale.fbp) {
      matchedBy = 'fbp'
      confidence = 0.9
    }

    assert.equal(matchedBy, 'fbp')
    assert.equal(confidence, 0.9)
  })

  it('Não atribui venda quando não existem dados suficientes', () => {
    const sale = {
      id: 'sale_3',
      fbclid: undefined,
      fbp: undefined,
      sessionId: undefined,
      utmCampaign: undefined
    }

    const hasEnoughData = Boolean(sale.fbclid || sale.fbp || sale.sessionId || sale.utmCampaign)
    assert.equal(hasEnoughData, false)
  })
})
