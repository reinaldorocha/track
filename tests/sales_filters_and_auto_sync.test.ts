import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { getDateRange } from '../src/lib/utils'
import { getAutoSyncStatus, triggerBackgroundMetaSyncIfNeeded } from '../src/lib/meta/auto-sync'
import { getCustomerJourneyForSale } from '../src/lib/tracking/journey'

describe('Filtros Rápidos de Vendas, Auto-Sync & Jornada do Comprador', () => {
  // 1. Resolução dos atalhos de data
  it('1. getDateRange resolve corretamente presets rápidos (Hoje, Ontem, 7 Dias, Este Mês)', () => {
    const hoje = getDateRange('Hoje')
    assert.equal(hoje.label, 'Hoje')
    assert.ok(hoje.from instanceof Date)
    assert.ok(hoje.to instanceof Date)
    assert.ok(hoje.from.getTime() <= hoje.to.getTime())

    const ontem = getDateRange('Ontem')
    assert.equal(ontem.label, 'Ontem')
    assert.ok(ontem.from.getTime() < hoje.from.getTime(), 'Ontem começa antes de Hoje')

    const seteDias = getDateRange('Últimos 7 dias')
    assert.equal(seteDias.label, 'Últimos 7 dias')
    const diffDias = Math.round((seteDias.to.getTime() - seteDias.from.getTime()) / (86400000))
    assert.ok(diffDias >= 6 && diffDias <= 8)

    const esteMes = getDateRange('Este mês')
    assert.equal(esteMes.label, 'Este mês')
    assert.equal(esteMes.from.getDate(), 1, 'Primeiro dia do mês deve ser dia 1')
  })

  // 2. Auto-Sync: Tratamento resiliente quando não há contas ativas
  it('2. triggerBackgroundMetaSyncIfNeeded: Retorna falso de forma segura quando não há contas ativas', async () => {
    const res = await triggerBackgroundMetaSyncIfNeeded('workspace_inexistente_999', 15)
    assert.equal(res.triggered, false)
    assert.equal(res.reason, 'no_active_accounts')
  })

  // 3. Auto-Sync Status: Estrutura válida e cálculo de minutos
  it('3. getAutoSyncStatus: Retorna estrutura completa com intervalo padrão de 15 minutos', async () => {
    const status = await getAutoSyncStatus('workspace_inexistente_999', 15)
    assert.equal(status.intervalMinutes, 15)
    assert.equal(status.enabled, false)
    assert.equal(status.totalAccounts, 0)
    assert.equal(status.activeAccounts, 0)
    assert.equal(status.isSyncing, false)
  })

  // 4. Jornada Multi-Touch: Resiliente com ID de venda inexistente
  it('4. getCustomerJourneyForSale: Retorna null de forma limpa para venda inexistente', async () => {
    const journey = await getCustomerJourneyForSale('sale_id_inexistente_abc', 'ws_mock')
    assert.equal(journey, null)
  })
})
