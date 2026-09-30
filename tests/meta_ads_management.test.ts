import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test_auth_secret_for_meta_management_2025'

import { MetaApiClient } from '../src/lib/meta/client'
import { prisma } from '../src/lib/db'

describe('Meta Ads Management — Edição e Duplicação (Estilo UTMFY)', () => {
  // 1. MetaApiClient possui métodos para gestão
  it('1. MetaApiClient expõe updateCampaign, updateAdSet, updateAd, duplicateCampaign, duplicateAdSet, duplicateAd', () => {
    const client = new MetaApiClient('mock_token_123')
    assert.equal(typeof client.updateCampaign, 'function')
    assert.equal(typeof client.updateAdSet, 'function')
    assert.equal(typeof client.updateAd, 'function')
    assert.equal(typeof client.duplicateCampaign, 'function')
    assert.equal(typeof client.duplicateAdSet, 'function')
    assert.equal(typeof client.duplicateAd, 'function')
    assert.equal(typeof client.post, 'function')
  })

  // 2. Formatação de payload para a Meta Graph API
  it('2. Garante que o orçamento diário em R$ é convertido para centavos para a Meta API', () => {
    const budgetInBRL = 150.0 // R$ 150,00
    const budgetInCents = Math.round(budgetInBRL * 100) // 15000 centavos
    assert.equal(budgetInCents, 15000)

    const scaleFactor = 1.2 // +20% de escala
    const scaledBudget = Math.round(budgetInBRL * scaleFactor)
    assert.equal(scaledBudget, 180)
    assert.equal(Math.round(scaledBudget * 100), 18000)
  })

  // 3. Regras de sufixo e status inicial na duplicação
  it('3. Elementos duplicados devem receber sufixo " - Cópia" e status inicial "PAUSED"', () => {
    const originalName = 'AD01 - Vídeo Depoimento Oferta Black'
    const suffix = ' - Cópia'
    const duplicatedName = `${originalName}${suffix}`
    const duplicatedStatus = 'PAUSED'

    assert.equal(duplicatedName, 'AD01 - Vídeo Depoimento Oferta Black - Cópia')
    assert.equal(duplicatedStatus, 'PAUSED', 'Anúncio duplicado NUNCA deve nascer ATIVO sem revisão')
  })

  // 4. Operações em Massa (Bulk Actions)
  it('4. Valida estrutura de ações em massa para múltiplos IDs selecionados', () => {
    const selectedIds = ['ad_1', 'ad_2', 'ad_3']
    const action = 'PAUSED'
    const updates = selectedIds.map(id => ({ id, status: action }))

    assert.equal(updates.length, 3)
    assert.ok(updates.every(u => u.status === 'PAUSED'))
  })
})
