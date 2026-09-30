'use client'

import { MetricCard } from './metric-card'
import { formatCurrency, formatNumber } from '@/lib/utils'

type MetricsData = {
  grossRevenue: number
  netRevenue: number
  adSpend: number
  sales: number
  approvedSales: number
  cpa: number | null
  cpc: number | null
  ctr: number | null
  cpm: number | null
  cpi: number | null
  roas: number | null
  roi: number | null
  profit: number
  margin: number | null
}

type MetricsGridProps = {
  data: MetricsData | null
  loading?: boolean
}

export function MetricsGrid({ data, loading }: MetricsGridProps) {
  const safeData = data || {
    grossRevenue: 0, netRevenue: 0, adSpend: 0, sales: 0, approvedSales: 0,
    cpa: null, cpc: null, ctr: null, cpm: null, cpi: null, roas: null, roi: null, profit: 0, margin: null
  }

  const metrics = [
    { title: 'Faturamento Bruto (R$)', value: formatCurrency(safeData.grossRevenue), tooltip: 'Total de vendas antes de taxas e devoluções' },
    { title: 'Faturamento Líquido (R$)', value: formatCurrency(safeData.netRevenue), tooltip: 'Faturamento após desconto de taxas' },
    { title: 'Investimento (R$)', value: formatCurrency(safeData.adSpend), tooltip: 'Total gasto em anúncios' },
    { title: 'Vendas', value: formatNumber(safeData.sales), tooltip: 'Número total de pedidos' },
    { title: 'Vendas Aprovadas', value: formatNumber(safeData.approvedSales), tooltip: 'Pedidos com pagamento confirmado' },
    { title: 'CPA (R$)', value: safeData.cpa !== null ? formatCurrency(safeData.cpa) : '-', tooltip: 'Custo médio por aquisição (venda)' },
    { title: 'CPC (R$)', value: safeData.cpc !== null ? formatCurrency(safeData.cpc) : '-', tooltip: 'Custo médio por clique' },
    { title: 'CTR (%)', value: safeData.ctr !== null ? `${formatNumber(safeData.ctr)}%` : '-', tooltip: 'Percentual de pessoas que clicaram no anúncio após vê-lo' },
    { title: 'CPM (R$)', value: safeData.cpm !== null ? formatCurrency(safeData.cpm) : '-', tooltip: 'Custo para cada mil impressões' },
    { title: 'CPI (R$)', value: safeData.cpi !== null ? formatCurrency(safeData.cpi) : '-', tooltip: 'Custo médio por início de checkout' },
    { title: 'ROAS', value: safeData.roas !== null ? formatNumber(safeData.roas) : '-', tooltip: 'Quanto foi faturado para cada R$ 1 investido em anúncios' },
    { title: 'ROI (%)', value: safeData.roi !== null ? `${formatNumber(safeData.roi)}%` : '-', tooltip: 'Retorno sobre investimento total' },
    { title: 'Lucro (R$)', value: formatCurrency(safeData.profit), tooltip: 'Receita líquida menos todos os custos' },
    { title: 'Margem (%)', value: safeData.margin !== null ? `${formatNumber(safeData.margin)}%` : '-', tooltip: 'Percentual de lucro sobre faturamento' }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <MetricCard
          key={i}
          title={m.title}
          value={m.value}
          tooltip={m.tooltip}
          loading={loading}
        />
      ))}
    </div>
  )
}
