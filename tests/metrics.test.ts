import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
import {
  calculateSaleFee,
  calculateFinancialMetrics,
  classifyPaymentMethodForFee
} from '../src/lib/calculations/financial-engine'
import {
  normalizeSaleInstallments
} from '../src/lib/integrations/normalizer'

describe('Cálculos de Métricas de Marketing e Finanças', () => {
  it('Cálculo de CPM (Custo por Mil Impressões)', () => {
    // CPM = (Gasto / Impressões) * 1000
    const cpm = calcCPM(500, 20000)
    assert.equal(cpm, 25)

    // Divisão por zero deve retornar null
    assert.equal(calcCPM(500, 0), null)
  })

  it('Cálculo de CPC (Custo por Clique)', () => {
    // CPC = Gasto / Cliques
    const cpc = calcCPC(500, 800)
    assert.equal(cpc, 0.625)

    // Divisão por zero deve retornar null
    assert.equal(calcCPC(500, 0), null)
  })

  it('Cálculo de CTR (Taxa de Cliques %)', () => {
    // CTR = (Cliques / Impressões) * 100
    const ctr = calcCTR(800, 20000)
    assert.equal(ctr, 4)

    // Divisão por zero deve retornar null
    assert.equal(calcCTR(800, 0), null)
  })

  it('Cálculo de CPI (Custo por Início de Checkout)', () => {
    // CPI = Gasto / Checkouts
    const cpi = calcCPI(500, 80)
    assert.equal(cpi, 6.25)

    // Divisão por zero deve retornar null
    assert.equal(calcCPI(500, 0), null)
  })

  it('Cálculo de CPA (Custo por Aquisição / Venda)', () => {
    // CPA = Gasto / Compras
    const cpa = calcCPA(500, 20)
    assert.equal(cpa, 25)

    // Divisão por zero deve retornar null
    assert.equal(calcCPA(500, 0), null)
  })

  it('Cálculo de ROAS (Retorno sobre Gasto em Anúncios)', () => {
    // ROAS = Faturamento / Gasto
    const roas = calcROAS(2000, 500)
    assert.equal(roas, 4)

    // Divisão por zero deve retornar null
    assert.equal(calcROAS(2000, 0), null)
  })

  it('Cálculo de ROI (Retorno sobre Investimento %)', () => {
    // ROI = (Lucro / Investimento) * 100
    const roi = calcROI(900, 500)
    assert.equal(roi, 180)

    // Divisão por zero deve retornar null
    assert.equal(calcROI(900, 0), null)
  })

  it('Cálculo de Margem de Lucro (%)', () => {
    // Margem = (Lucro / Faturamento) * 100
    const margin = calcMargin(900, 2000)
    assert.equal(margin, 45)

    // Divisão por zero deve retornar null
    assert.equal(calcMargin(900, 0), null)
  })

  it('Cálculo de Lucro Líquido Real', () => {
    // Lucro = Receita líquida - custos - despesas - investimento em anúncios
    const profit = calcProfit({
      netRevenue: 2000,
      adSpend: 500,
      productCost: 400,
      fees: 100,
      taxes: 60,
      expenses: 40
    })
    assert.equal(profit, 900)
  })

  it('Formatação segura de métricas (valores nulos retornam "—")', () => {
    assert.equal(formatMetric(null, 'currency'), '—')
    assert.equal(formatMetric(null, 'percent'), '—')
    assert.equal(formatMetric(null, 'ratio'), '—')
    assert.equal(formatMetric(4, 'ratio'), '4.00x')
    assert.equal(formatMetric(25, 'percent'), '25.00%')
  })
})

describe('Filtros de Período e Agregações Temporais', () => {
  const { getDateRange } = require('../src/lib/utils')

  it('Filtro de Período: Suporta Hoje, Ontem, 7d, 15d, 30d, 60d, 90d, Este mês, Mês anterior', () => {
    const rHoje = getDateRange('Hoje')
    const rOntem = getDateRange('Ontem')
    const r7d = getDateRange('Últimos 7 dias')
    const r15d = getDateRange('Últimos 15 dias')
    const r30d = getDateRange('Últimos 30 dias')
    const r60d = getDateRange('Últimos 60 dias')
    const r90d = getDateRange('Últimos 90 dias')
    const rEsteMes = getDateRange('Este mês')
    const rMesAnterior = getDateRange('Mês anterior')

    assert.equal(rHoje.label, 'Hoje')
    assert.equal(rOntem.label, 'Ontem')
    assert.equal(r7d.label, 'Últimos 7 dias')
    assert.equal(r15d.label, 'Últimos 15 dias')
    assert.equal(r30d.label, 'Últimos 30 dias')
    assert.equal(r60d.label, 'Últimos 60 dias')
    assert.equal(r90d.label, 'Últimos 90 dias')
    assert.equal(rEsteMes.label, 'Este mês')
    assert.equal(rMesAnterior.label, 'Mês anterior')
  })

  it('Filtro Hoje vs 30 dias: Intervalos temporais são estritamente diferentes', () => {
    const rHoje = getDateRange('Hoje')
    const r30d = getDateRange('Últimos 30 dias')

    assert.notEqual(rHoje.from.toISOString(), r30d.from.toISOString(), 'Data inicial de Hoje e 30 dias devem ser distintas')
    assert.ok(r30d.from.getTime() < rHoje.from.getTime(), '30 dias deve iniciar antes de Hoje')
  })

  it('Agregação de Vendas: Apenas status approved/paid somam no faturamento bruto', () => {
    const sales = [
      { id: '1', status: 'approved', grossAmount: 100, netAmount: 90 },
      { id: '2', status: 'paid', grossAmount: 200, netAmount: 180 },
      { id: '3', status: 'pending', grossAmount: 150, netAmount: 150 },
      { id: '4', status: 'refunded', grossAmount: 100, netAmount: 100 },
      { id: '5', status: 'chargeback', grossAmount: 50, netAmount: 50 }
    ]

    const approvedList = sales.filter(s => s.status === 'approved' || s.status === 'paid')
    const grossRevenue = approvedList.reduce((acc, s) => acc + s.grossAmount, 0)
    const netRevenue = approvedList.reduce((acc, s) => acc + s.netAmount, 0)

    assert.equal(approvedList.length, 2)
    assert.equal(grossRevenue, 300)
    assert.equal(netRevenue, 270)
  })

  it('Classificação de Método de Pagamento para Regras de Taxa', () => {
    assert.equal(classifyPaymentMethodForFee('pix', null, 1), 'pix')
    assert.equal(classifyPaymentMethodForFee('PIX', null, 1), 'pix')
    assert.equal(classifyPaymentMethodForFee('boleto', null, 1), 'boleto')
    assert.equal(classifyPaymentMethodForFee('credit_card', null, 1), 'card_single')
    assert.equal(classifyPaymentMethodForFee('credit_card', null, 3), 'card_installments')
    assert.equal(classifyPaymentMethodForFee(null, 'card', 12), 'card_installments')
  })

  it('Cálculo de Taxas por Método: Pix, Cartão à Vista e Cartão Parcelado', () => {
    const feeRules = [
      {
        id: '1',
        name: 'Taxa Pix',
        type: 'checkout',
        paymentMethod: 'pix',
        percentage: 1.99,
        fixedAmount: 0.0,
        isActive: true
      },
      {
        id: '2',
        name: 'Taxa Cartão à Vista',
        type: 'checkout',
        paymentMethod: 'card_single',
        percentage: 3.99,
        fixedAmount: 1.00,
        isActive: true
      },
      {
        id: '3',
        name: 'Taxa Cartão Parcelado',
        type: 'checkout',
        paymentMethod: 'card_installments',
        percentage: 4.99,
        fixedAmount: 1.00,
        installmentFee: 1.50, // 1.5% adicional por parcela além da 1ª
        isActive: true
      }
    ]

    // 1. Venda Pix de R$ 100: 100 * 1.99% = 1.99
    const pixFee = calculateSaleFee(
      { grossAmount: 100, paymentMethod: 'pix', installments: 1 },
      feeRules
    )
    assert.equal(pixFee, 1.99)

    // 2. Venda Cartão 1x de R$ 100: 100 * 3.99% + 1.00 = 4.99
    const cardSingleFee = calculateSaleFee(
      { grossAmount: 100, paymentMethod: 'card', installments: 1 },
      feeRules
    )
    assert.equal(cardSingleFee, 4.99)

    // 3. Venda Cartão em 3x de R$ 100:
    // Base: 100 * 4.99% + 1.00 = 5.99
    // Parcelamento: (3 - 1) * 1.50% * 100 = 3.00
    // Total = 5.99 + 3.00 = 8.99
    const cardInstFee = calculateSaleFee(
      { grossAmount: 100, paymentMethod: 'card', installments: 3 },
      feeRules
    )
    assert.equal(cardInstFee, 8.99)
  })

  it('Prioridade de Plataforma: Regra específica de checkout sobrepõe regra geral', () => {
    const feeRules = [
      {
        name: 'Geral Pix',
        type: 'checkout',
        paymentMethod: 'pix',
        percentage: 2.0,
        fixedAmount: 0.0,
        platform: null,
        isActive: true
      },
      {
        name: 'Getfy Pix Promocional',
        type: 'checkout',
        paymentMethod: 'pix',
        percentage: 0.99,
        fixedAmount: 0.0,
        platform: 'getfy',
        isActive: true
      }
    ]

    const getfyFee = calculateSaleFee(
      { grossAmount: 100, platform: 'getfy', paymentMethod: 'pix' },
      feeRules
    )
    assert.equal(getfyFee, 0.99)

    const caktoFee = calculateSaleFee(
      { grossAmount: 100, platform: 'cakto', paymentMethod: 'pix' },
      feeRules
    )
    assert.equal(caktoFee, 2.0)
  })

  it('Motor Financeiro: Dedução de Imposto Meta Ads (IOF), Taxas de Checkout e Imposto s/ Faturamento', () => {
    const sales = [
      { id: 's1', grossAmount: 1000, paymentMethod: 'pix', installments: 1 },
      { id: 's2', grossAmount: 1000, paymentMethod: 'card', installments: 1 },
      { id: 's3', grossAmount: 1000, paymentMethod: 'card', installments: 3 }
    ]

    const fees = [
      { name: 'Pix', type: 'checkout', paymentMethod: 'pix', percentage: 1.0, fixedAmount: 0, isActive: true },
      { name: 'Cartão 1x', type: 'checkout', paymentMethod: 'card_single', percentage: 3.0, fixedAmount: 0, isActive: true },
      { name: 'Cartão 3x', type: 'checkout', paymentMethod: 'card_installments', percentage: 5.0, fixedAmount: 0, installmentFee: 1.0, isActive: true }
    ]

    const taxes = [
      { name: 'IOF Meta Ads', type: 'meta_ads', percentage: 0.38, isActive: true },
      { name: 'Simples Nacional', type: 'sales', percentage: 6.0, isActive: true }
    ]

    const adSpend = 1000 // R$ 1.000,00 investidos no Meta Ads
    const expenses = 100 // R$ 100,00 de ferramentas

    const result = calculateFinancialMetrics({
      sales,
      fees,
      taxes,
      adSpend,
      expenses
    })

    // Faturamento bruto = 3 x 1000 = 3000
    assert.equal(result.grossRevenue, 3000)

    // Taxas calculadas:
    // s1 (Pix): 1000 * 1% = 10
    // s2 (Cartão 1x): 1000 * 3% = 30
    // s3 (Cartão 3x): 1000 * (5% + 2 * 1%) = 70
    // Total fees = 10 + 30 + 70 = 110
    assert.equal(result.totalFees, 110)
    assert.equal(result.feeBreakdown.pix, 10)
    assert.equal(result.feeBreakdown.cardSingle, 30)
    assert.equal(result.feeBreakdown.cardInstallments, 70)

    // Faturamento líquido = 3000 - 110 = 2890
    assert.equal(result.netRevenue, 2890)

    // Imposto Meta Ads: 1000 * 0.38% = 3.80
    assert.equal(result.metaAdsTaxAmount, 3.80)
    assert.equal(result.totalAdCostWithTaxes, 1003.80)

    // Imposto Vendas: 3000 * 6% = 180
    assert.equal(result.salesTaxAmount, 180)

    // Lucro Líquido Real = 3000 - 110 - 1000 - 3.80 - 180 - 100 = 1606.20
    assert.equal(result.netProfit, 1606.20)

    // Margem real: (1606.20 / 3000) * 100 = 53.54%
    assert.equal(result.margin, 53.54)

    // ROAS simples = 3000 / 1000 = 3.00x
    assert.equal(result.roas, 3.00)

    // ROAS Real com imposto do Meta = 3000 / 1003.80 = 2.99x
    assert.equal(result.realRoas, 2.99)
  })

  it('Normalizador de Parcelas: Extrai corretamente número de parcelas de payloads de checkout', () => {
    assert.equal(normalizeSaleInstallments({ installments: 6 }), 6)
    assert.equal(normalizeSaleInstallments({ data: { installments: 12 } }), 12)
    assert.equal(normalizeSaleInstallments({ purchase: { installments_number: 4 } }), 4)
    assert.equal(normalizeSaleInstallments({ Order: { installments: 2 } }), 2)
    assert.equal(normalizeSaleInstallments({}), 1)
  })
})
