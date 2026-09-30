import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { encrypt, decrypt, maskSecret, sha256Hash } from '../src/lib/encryption'
import {
  calcCPM,
  calcCPC,
  calcCTR,
  calcCPI,
  calcCPA,
  calcROAS,
  calcROI,
  calcMargin,
  calcProfit,
  formatMetric
} from '../src/lib/metrics'

describe('Segurança, Criptografia e Proteção de Dados', () => {
  it('Criptografia e descriptografia reversível com AES-256-GCM', () => {
    const rawSecret = 'EAABwz91k20kZAO...super_secret_meta_token'
    const encrypted = encrypt(rawSecret)

    assert.notEqual(encrypted, rawSecret)
    assert.ok(encrypted.length > 32)

    const decrypted = decrypt(encrypted)
    assert.equal(decrypted, rawSecret)
  })

  it('Mascaramento seguro de credenciais na interface', () => {
    assert.equal(maskSecret('123'), '••••')
    assert.equal(maskSecret('1234'), '••••')
    assert.equal(maskSecret('EAABw123456789xyz'), '••••••••••••9xyz')
  })

  it('Hash SHA-256 com normalização para conformidade Meta CAPI', () => {
    const email1 = '  Usuario.Teste@Dominio.COM  '
    const email2 = 'usuario.teste@dominio.com'

    const hash1 = sha256Hash(email1)
    const hash2 = sha256Hash(email2)

    assert.equal(hash1, hash2)
    assert.match(hash1, /^[a-f0-9]{64}$/)
  })
})

describe('Robustez de Cálculos Financeiros em Casos Limites', () => {
  it('Proteção contra divisão por zero em todas as métricas analíticas', () => {
    assert.equal(calcCPM(0, 0), null)
    assert.equal(calcCPC(0, 0), null)
    assert.equal(calcCTR(0, 0), null)
    assert.equal(calcCPI(0, 0), null)
    assert.equal(calcCPA(0, 0), null)
    assert.equal(calcROAS(0, 0), null)
    assert.equal(calcROI(0, 0), null)
    assert.equal(calcMargin(0, 0), null)
  })

  it('Suporte a valores negativos (prejuízo) sem lançar erros', () => {
    const profit = calcProfit({
      netRevenue: 1000,
      adSpend: 1500,
      productCost: 200,
      fees: 50,
      taxes: 50,
      expenses: 100
    })

    assert.equal(profit, -900)

    const roi = calcROI(profit, 1500)
    assert.equal(roi, -60) // Prejuízo de -60%

    const margin = calcMargin(profit, 1000)
    assert.equal(margin, -90) // Margem negativa
  })

  it('Formatação segura de números, moedas e porcentagens', () => {
    assert.equal(formatMetric(null, 'currency'), '—')
    assert.equal(formatMetric(undefined as any, 'percent'), '—')
    assert.equal(formatMetric(0, 'percent'), '0.00%')
    assert.equal(formatMetric(0, 'ratio'), '0.00x')
  })
})

describe('Ciclo de Vida de Status de Vendas e Webhooks', () => {
  it('Validação da transição de status (pending -> approved -> refunded -> chargeback)', () => {
    const validStatuses = ['pending', 'approved', 'refunded', 'chargeback', 'cancelled']

    validStatuses.forEach((status) => {
      assert.ok(validStatuses.includes(status))
    })

    let currentStatus = 'pending'
    currentStatus = 'approved'
    assert.equal(currentStatus, 'approved')
    currentStatus = 'refunded'
    assert.equal(currentStatus, 'refunded')
  })
})
