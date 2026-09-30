/**
 * Financial Calculation Engine for UTM-Track
 * Suporte completo a:
 * 1. Taxas de Imposto sobre Anúncios do Meta Ads (IOF / Taxas s/ Tráfego Pago)
 * 2. Taxas de Checkout por Método de Pagamento (Pix, Cartão à Vista, Cartão Parcelado, Boleto)
 * 3. Imposto sobre Faturamento / Vendas (Simples Nacional / NF)
 * 4. Deduções em tempo real do Lucro Líquido Real, Margem, ROI e ROAS
 */

export interface FeeRule {
  id?: string
  name: string
  type: string // gateway, checkout, platform, other
  paymentMethod?: string | null // pix, card_single, card_installments, boleto, all
  percentage: number
  fixedAmount: number
  installmentFee?: number | null // taxa adicional por parcela (%) para cartão parcelado
  platform?: string | null
  isActive?: boolean
}

export interface TaxRule {
  id?: string
  name: string
  type?: string | null // sales, meta_ads
  percentage: number
  platform?: string | null
  isActive?: boolean
}

export interface SaleFinancialInput {
  id?: string
  grossAmount: number
  netAmount?: number | null
  platform?: string | null
  paymentMethod?: string | null
  externalRef?: string | null
  installments?: number | null
  status?: string | null
}

export interface FinancialCalculationResult {
  grossRevenue: number
  netRevenue: number
  totalFees: number
  feeBreakdown: {
    pix: number
    cardSingle: number
    cardInstallments: number
    boleto: number
    other: number
  }
  salesCountByMethod: {
    pix: number
    cardSingle: number
    cardInstallments: number
    boleto: number
    other: number
  }
  adSpend: number
  metaAdsTaxRate: number
  metaAdsTaxAmount: number
  totalAdCostWithTaxes: number
  salesTaxRate: number
  salesTaxAmount: number
  totalTaxes: number
  totalExpenses: number
  totalInvestment: number
  netProfit: number
  margin: number
  roi: number
  roas: number
  realRoas: number
}

/**
 * Normaliza a chave do método de pagamento para regras de taxa
 */
export function classifyPaymentMethodForFee(
  paymentMethod?: string | null,
  externalRef?: string | null,
  installments?: number | null
): 'pix' | 'card_single' | 'card_installments' | 'boleto' | 'other' {
  const raw = String(paymentMethod || externalRef || '').toLowerCase().trim()
  const instCount = installments && installments > 0 ? installments : 1

  if (raw.includes('pix')) return 'pix'
  if (raw.includes('boleto') || raw.includes('billet') || raw.includes('bank_slip')) return 'boleto'
  if (raw.includes('card') || raw.includes('cartao') || raw.includes('credito') || raw.includes('debito')) {
    return instCount > 1 ? 'card_installments' : 'card_single'
  }

  // Se não especificou mas tem mais de 1 parcela, é cartão parcelado
  if (instCount > 1) return 'card_installments'

  return 'other'
}

/**
 * Calcula a taxa de uma venda individual com base nas regras configuradas
 */
export function calculateSaleFee(sale: SaleFinancialInput, fees: FeeRule[]): number {
  const gross = Math.max(0, sale.grossAmount || 0)
  if (gross === 0) return 0

  const activeFees = fees.filter(f => f.isActive !== false)
  if (activeFees.length === 0) {
    // Se não há taxas customizadas configuradas, usa a retenção reportada pelo gateway se houver
    if (sale.netAmount !== undefined && sale.netAmount !== null && sale.netAmount > 0 && sale.netAmount < gross) {
      return Math.round((gross - sale.netAmount) * 100) / 100
    }
    return 0
  }

  const method = classifyPaymentMethodForFee(sale.paymentMethod, sale.externalRef, sale.installments)
  const platform = (sale.platform || '').toLowerCase().trim()
  const instCount = sale.installments && sale.installments > 0 ? sale.installments : 1

  // Procura regra por prioridade de especificidade:
  // 1. Plataforma específica + Método específico (ex: getfy + pix)
  // 2. Plataforma específica + Método geral ('all' ou vazio)
  // 3. Plataforma geral + Método específico (ex: todas + pix)
  // 4. Plataforma geral + Método geral
  let matchingRule = activeFees.find(f => {
    const fPlat = (f.platform || '').toLowerCase().trim()
    const fMethod = (f.paymentMethod || '').toLowerCase().trim()
    return fPlat && fPlat === platform && fMethod === method
  })

  if (!matchingRule) {
    matchingRule = activeFees.find(f => {
      const fPlat = (f.platform || '').toLowerCase().trim()
      const fMethod = (f.paymentMethod || '').toLowerCase().trim()
      return fPlat && fPlat === platform && (!fMethod || fMethod === 'all')
    })
  }

  if (!matchingRule) {
    matchingRule = activeFees.find(f => {
      const fPlat = (f.platform || '').toLowerCase().trim()
      const fMethod = (f.paymentMethod || '').toLowerCase().trim()
      return (!fPlat || fPlat === 'all') && fMethod === method
    })
  }

  if (!matchingRule) {
    matchingRule = activeFees.find(f => {
      const fPlat = (f.platform || '').toLowerCase().trim()
      const fMethod = (f.paymentMethod || '').toLowerCase().trim()
      return (!fPlat || fPlat === 'all') && (!fMethod || fMethod === 'all')
    })
  }

  if (matchingRule) {
    const basePct = (matchingRule.percentage || 0) / 100
    const fixed = matchingRule.fixedAmount || 0
    let total = (gross * basePct) + fixed

    // Adicional de parcelamento caso configurado na regra
    if (method === 'card_installments' && instCount > 1 && matchingRule.installmentFee && matchingRule.installmentFee > 0) {
      const instRate = (matchingRule.installmentFee / 100) * (instCount - 1)
      total += (gross * instRate)
    }

    return Math.round(total * 100) / 100
  }

  // Fallback: diferença bruta e líquida informada pela integração
  if (sale.netAmount !== undefined && sale.netAmount !== null && sale.netAmount > 0 && sale.netAmount < gross) {
    return Math.round((gross - sale.netAmount) * 100) / 100
  }

  return 0
}

/**
 * Motor central de cálculo financeiro integrado
 */
export function calculateFinancialMetrics(params: {
  sales: SaleFinancialInput[]
  fees: FeeRule[]
  taxes: TaxRule[]
  adSpend: number
  expenses: number
}): FinancialCalculationResult {
  const { sales, fees, taxes, adSpend, expenses } = params

  const grossRevenue = sales.reduce((acc, s) => acc + (s.grossAmount || 0), 0)

  let totalFees = 0
  const feeBreakdown = {
    pix: 0,
    cardSingle: 0,
    cardInstallments: 0,
    boleto: 0,
    other: 0
  }
  const salesCountByMethod = {
    pix: 0,
    cardSingle: 0,
    cardInstallments: 0,
    boleto: 0,
    other: 0
  }

  for (const s of sales) {
    const method = classifyPaymentMethodForFee(s.paymentMethod, s.externalRef, s.installments)
    const fee = calculateSaleFee(s, fees)
    totalFees += fee

    if (method === 'pix') {
      feeBreakdown.pix += fee
      salesCountByMethod.pix += 1
    } else if (method === 'card_single') {
      feeBreakdown.cardSingle += fee
      salesCountByMethod.cardSingle += 1
    } else if (method === 'card_installments') {
      feeBreakdown.cardInstallments += fee
      salesCountByMethod.cardInstallments += 1
    } else if (method === 'boleto') {
      feeBreakdown.boleto += fee
      salesCountByMethod.boleto += 1
    } else {
      feeBreakdown.other += fee
      salesCountByMethod.other += 1
    }
  }

  // Arredondar breakdowns
  feeBreakdown.pix = Math.round(feeBreakdown.pix * 100) / 100
  feeBreakdown.cardSingle = Math.round(feeBreakdown.cardSingle * 100) / 100
  feeBreakdown.cardInstallments = Math.round(feeBreakdown.cardInstallments * 100) / 100
  feeBreakdown.boleto = Math.round(feeBreakdown.boleto * 100) / 100
  feeBreakdown.other = Math.round(feeBreakdown.other * 100) / 100
  totalFees = Math.round(totalFees * 100) / 100

  const netRevenue = Math.max(0, Math.round((grossRevenue - totalFees) * 100) / 100)

  // Separar taxas de impostos: Meta Ads / IOF vs Vendas
  const activeTaxes = taxes.filter(t => t.isActive !== false)

  const metaAdsTaxes = activeTaxes.filter(t => {
    const tp = (t.type || '').toLowerCase().trim()
    const nm = (t.name || '').toLowerCase().trim()
    return tp === 'meta_ads' || nm.includes('meta') || nm.includes('iof') || nm.includes('anúncio') || nm.includes('anuncio') || nm.includes('trafego')
  })

  const salesTaxes = activeTaxes.filter(t => {
    const tp = (t.type || '').toLowerCase().trim()
    const nm = (t.name || '').toLowerCase().trim()
    const isMeta = tp === 'meta_ads' || nm.includes('meta') || nm.includes('iof') || nm.includes('anúncio') || nm.includes('anuncio') || nm.includes('trafego')
    return !isMeta
  })

  const metaAdsTaxRate = metaAdsTaxes.reduce((sum, t) => sum + (t.percentage || 0), 0)
  const metaAdsTaxAmount = Math.round((adSpend * (metaAdsTaxRate / 100)) * 100) / 100
  const totalAdCostWithTaxes = Math.round((adSpend + metaAdsTaxAmount) * 100) / 100

  const salesTaxRate = salesTaxes.reduce((sum, t) => sum + (t.percentage || 0), 0)
  const salesTaxAmount = Math.round((grossRevenue * (salesTaxRate / 100)) * 100) / 100

  const totalTaxes = Math.round((metaAdsTaxAmount + salesTaxAmount) * 100) / 100
  const totalExpenses = Math.round(expenses * 100) / 100

  // Lucro Líquido Real = Faturamento Bruto - Taxas do Checkout - Gasto de Anúncios - Imposto de Anúncios - Imposto de Vendas - Despesas
  const netProfit = Math.round((grossRevenue - totalFees - adSpend - metaAdsTaxAmount - salesTaxAmount - totalExpenses) * 100) / 100

  // Total de investimento realizado para gerar esse resultado
  const totalInvestment = Math.round((adSpend + metaAdsTaxAmount + totalFees + salesTaxAmount + totalExpenses) * 100) / 100

  // Margem de lucro (%)
  const margin = grossRevenue > 0 ? Math.round(((netProfit / grossRevenue) * 100) * 100) / 100 : 0

  // ROI (%)
  const roi = totalInvestment > 0 ? Math.round(((netProfit / totalInvestment) * 100) * 100) / 100 : 0

  // ROAS simples (Receita / Ad Spend)
  const roas = adSpend > 0 ? Math.round((grossRevenue / adSpend) * 100) / 100 : 0

  // ROAS Real considerando imposto do Meta Ads
  const realRoas = totalAdCostWithTaxes > 0 ? Math.round((grossRevenue / totalAdCostWithTaxes) * 100) / 100 : 0

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    netRevenue,
    totalFees,
    feeBreakdown,
    salesCountByMethod,
    adSpend: Math.round(adSpend * 100) / 100,
    metaAdsTaxRate: Math.round(metaAdsTaxRate * 100) / 100,
    metaAdsTaxAmount,
    totalAdCostWithTaxes,
    salesTaxRate: Math.round(salesTaxRate * 100) / 100,
    salesTaxAmount,
    totalTaxes,
    totalExpenses,
    totalInvestment,
    netProfit,
    margin,
    roi,
    roas,
    realRoas
  }
}
