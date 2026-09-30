'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Percent,
  RefreshCw,
  Clock,
  RotateCcw,
  ShieldAlert,
  MessageSquare,
  Users,
  Target,
  FileSpreadsheet,
  CreditCard,
  Receipt,
  Filter,
  Sliders,
  Move,
  GripVertical,
  Check,
} from 'lucide-react'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { getDateRange, formatCurrency, formatMetric, formatPercent, formatNumber } from '@/lib/utils'
import { SummaryKpiCard } from '@/components/summary/summary-kpi-card'
import { ConversionFunnel } from '@/components/summary/conversion-funnel'
import { HourlyRevenueChart } from '@/components/summary/hourly-revenue-chart'
import { HourlyProfitChart } from '@/components/summary/hourly-profit-chart'
import { SalesByCountry } from '@/components/summary/sales-by-country'
import { PaymentMethodsCard } from '@/components/summary/payment-methods-card'
import { SourceDistributionCard } from '@/components/summary/source-distribution-card'
import { ProductSalesCard } from '@/components/summary/product-sales-card'
import { SrcDistributionCard } from '@/components/summary/src-distribution-card'
import { DailySalesCard } from '@/components/summary/daily-sales-card'
import { WeekdaySalesCard } from '@/components/summary/weekday-sales-card'
import {
  CustomizeWidgetsModal,
  PREDEFINED_LAYOUTS,
  getLayoutWidgets,
} from '@/components/summary/customize-widgets-modal'

export const DEFAULT_KPI_ORDER: string[] = [
  'grossRevenue',
  'fees',
  'netRevenue',
  'adSpend',
  'impostoMeta',
  'profit',
  'pending',
  'expenses',
  'roi',
  'roas',
  'arpu',
  'impostoVendas',
  'impostoTotal',
  'cpa',
  'margin',
  'refunds',
  'taxaReembolso',
  'chargebacks',
  'taxaChargeback',
  'leads',
  'conversas',
  'cpl',
  'cpc_conversa',
  'cpc',
  'cpm',
  'ctr',
  'cpi',
]

export default function DashboardPage() {
  const [period, setPeriod] = useState({
    preset: 'Últimos 30 dias',
    ...getDateRange('last30days'),
  })

  // Filtros Globais do Topo
  const [selectedAdAccount, setSelectedAdAccount] = useState('all')
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [selectedTrafficSource, setSelectedTrafficSource] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState('all')
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false)

  // Controle de Personalização de Quadros e Layouts
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false)
  const [activeLayout, setActiveLayout] = useState<string>('basico')
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>(() => getLayoutWidgets('basico'))

  // Controle de Ordem e Reorganização (Drag & Drop) dos Cards de KPI
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [kpiOrder, setKpiOrder] = useState<string[]>(DEFAULT_KPI_ORDER)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // Carregar preferências salvas no localStorage
  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem('utmtrack_summary_active_layout')
      const savedWidgets = localStorage.getItem('utmtrack_summary_visible_widgets')

      const CURRENT_LAYOUT_VER = 'v5_weekday_sales_layout'
      const savedLayoutVer = localStorage.getItem('utmtrack_dashboard_layout_ver')

      if (savedLayoutVer !== CURRENT_LAYOUT_VER) {
        localStorage.setItem('utmtrack_dashboard_layout_ver', CURRENT_LAYOUT_VER)
        const layoutId = savedLayout && PREDEFINED_LAYOUTS.some((p) => p.id === savedLayout)
          ? savedLayout
          : 'basico'
        const updated = getLayoutWidgets(layoutId)
        if (savedWidgets) {
          try {
            const parsed = JSON.parse(savedWidgets)
            Object.assign(updated, parsed)
            updated.weekdaySales = true
          } catch {}
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibleWidgets(updated)
        setActiveLayout(layoutId)
        localStorage.setItem('utmtrack_summary_visible_widgets', JSON.stringify(updated))
      } else if (savedWidgets) {
        setVisibleWidgets(JSON.parse(savedWidgets))
        setActiveLayout(savedLayout || 'custom')
      } else {
        const initial = getLayoutWidgets('basico')
        setVisibleWidgets(initial)
        setActiveLayout('basico')
      }

      const CURRENT_ORDER_VER = 'v3_user_basico_order'
      const savedVersion = localStorage.getItem('utmtrack_dashboard_kpi_order_ver')
      const savedOrder = localStorage.getItem('utmtrack_dashboard_kpi_order')

      if (savedVersion !== CURRENT_ORDER_VER) {
        setKpiOrder(DEFAULT_KPI_ORDER)
        localStorage.setItem('utmtrack_dashboard_kpi_order', JSON.stringify(DEFAULT_KPI_ORDER))
        localStorage.setItem('utmtrack_dashboard_kpi_order_ver', CURRENT_ORDER_VER)
      } else if (savedOrder) {
        const parsed = JSON.parse(savedOrder)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const combined = [...parsed]
          DEFAULT_KPI_ORDER.forEach((id) => {
            if (!combined.includes(id)) combined.push(id)
          })
          setKpiOrder(combined)
        }
      }
    } catch (e) {
      console.error('Erro ao carregar preferências de widgets:', e)
    }
  }, [])

  const saveKpiOrder = (newOrder: string[]) => {
    setKpiOrder(newOrder)
    try {
      localStorage.setItem('utmtrack_dashboard_kpi_order', JSON.stringify(newOrder))
      localStorage.setItem('utmtrack_dashboard_kpi_order_ver', 'v3_user_basico_order')
    } catch (e) {
      console.error('Erro ao salvar ordem dos quadros:', e)
    }
  }

  const handleResetKpiOrder = () => {
    saveKpiOrder(DEFAULT_KPI_ORDER)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dropTargetId !== id) {
      setDropTargetId(id)
    }
  }

  const handleDragLeave = () => {
    setDropTargetId(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setDropTargetId(null)
      return
    }
    const fromIndex = kpiOrder.indexOf(draggingId)
    const toIndex = kpiOrder.indexOf(targetId)
    if (fromIndex !== -1 && toIndex !== -1) {
      const nextOrder = [...kpiOrder]
      const [moved] = nextOrder.splice(fromIndex, 1)
      nextOrder.splice(toIndex, 0, moved)
      saveKpiOrder(nextOrder)
    }
    setDraggingId(null)
    setDropTargetId(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDropTargetId(null)
  }

  const handleMoveStep = (id: string, delta: number) => {
    const idx = kpiOrder.indexOf(id)
    if (idx === -1) return
    const targetIdx = idx + delta
    if (targetIdx < 0 || targetIdx >= kpiOrder.length) return
    const next = [...kpiOrder]
    const [item] = next.splice(idx, 1)
    next.splice(targetIdx, 0, item)
    saveKpiOrder(next)
  }

  const handleSaveWidgets = (newSettings: Record<string, boolean>, layoutId?: string) => {
    setVisibleWidgets(newSettings)
    if (layoutId) setActiveLayout(layoutId)
    try {
      localStorage.setItem('utmtrack_summary_visible_widgets', JSON.stringify(newSettings))
      if (layoutId) {
        localStorage.setItem('utmtrack_summary_active_layout', layoutId)
      }
    } catch (e) {
      console.error('Erro ao salvar preferências de widgets:', e)
    }
  }

  const handleApplyPresetDirect = (layoutId: string) => {
    const widgets = getLayoutWidgets(layoutId)
    handleSaveWidgets(widgets, layoutId)
    if (layoutId === 'basico') {
      saveKpiOrder(DEFAULT_KPI_ORDER)
    }
  }

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'summary-consolidated',
      period.from.toISOString(),
      period.to.toISOString(),
      selectedAdAccount,
      selectedPlatform,
      selectedTrafficSource,
      selectedProduct,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        adAccountId: selectedAdAccount,
        platform: selectedPlatform,
        utmSource: selectedTrafficSource,
        productId: selectedProduct,
      })
      const res = await fetch(`/api/summary?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar dados do resumo')
      return res.json()
    },
  })

  const renderKpiCard = (id: string) => {
    switch (id) {
      case 'grossRevenue':
        return (
          <SummaryKpiCard
            title="Faturamento Bruto"
            value={formatCurrency(data?.grossRevenue || 0)}
            subtitle={`${data?.approvedSalesCount || 0} vendas aprovadas`}
            tooltip="Total arrecadado em pedidos aprovados antes da dedução de taxas e despesas"
            icon={<DollarSign className="w-4 h-4 text-blue-500" />}
            loading={isLoading}
          />
        )
      case 'adSpend':
        return (
          <SummaryKpiCard
            title="Gastos com Anúncios"
            value={formatCurrency(data?.totalSpend || 0)}
            subtitle={`${formatNumber(data?.totalClicks || 0)} cliques sincronizados`}
            tooltip="Investimento total em campanhas de anúncios sincronizadas do Meta Ads"
            icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
            loading={isLoading}
          />
        )
      case 'profit':
        return (
          <SummaryKpiCard
            title="Lucro Real"
            value={formatCurrency(data?.profit || 0)}
            subtitle={`Margem: ${formatPercent(data?.margin || 0)}`}
            tooltip="Faturamento líquido menos investimento em anúncios, impostos (Meta Ads e vendas), taxas de checkout e despesas"
            variant={(data?.profit || 0) >= 0 ? 'positive' : 'negative'}
            icon={
              (data?.profit || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              )
            }
            loading={isLoading}
          />
        )
      case 'netRevenue':
        return (
          <SummaryKpiCard
            title="Faturamento Líquido"
            value={formatCurrency(data?.netRevenue || 0)}
            subtitle="Após taxas de gateway"
            tooltip="Receita disponível após o desconto das taxas da plataforma de pagamento"
            icon={<DollarSign className="w-4 h-4 text-indigo-500" />}
            loading={isLoading}
          />
        )
      case 'pending':
        return (
          <SummaryKpiCard
            title="Vendas Pendentes"
            value={formatCurrency(data?.pendingAmount || 0)}
            subtitle={`${data?.pendingCount || 0} pedidos aguardando`}
            tooltip="Pedidos com Pix gerado ou boleto emitido ainda não confirmados"
            variant="warning"
            icon={<Clock className="w-4 h-4 text-amber-500" />}
            loading={isLoading}
          />
        )
      case 'fees':
        return (
          <SummaryKpiCard
            title="Taxas de Checkout"
            value={formatCurrency(data?.totalFees || 0)}
            subtitle="Pix, Cartão e Boleto"
            tooltip={`Taxas retidas no checkout conforme regras configuradas.${
              data?.feeBreakdown
                ? ` Pix: ${formatCurrency(data.feeBreakdown.pix || 0)} | Cartão 1x: ${formatCurrency(
                    data.feeBreakdown.cardSingle || 0
                  )} | Parcelado: ${formatCurrency(data.feeBreakdown.cardInstallments || 0)}.`
                : ''
            }`}
            icon={<CreditCard className="w-4 h-4 text-blue-500" />}
            loading={isLoading}
          />
        )
      case 'expenses':
        return (
          <SummaryKpiCard
            title="Despesas"
            value={formatCurrency(data?.totalExpenses ?? 0)}
            subtitle={
              data?.expensesCount !== undefined
                ? `${data.expensesCount} ${data.expensesCount === 1 ? 'lançamento' : 'lançamentos'}`
                : 'Custos operacionais'
            }
            tooltip="Despesas e custos operacionais cadastrados, deduzidos do Lucro Líquido Real"
            icon={<Receipt className="w-4 h-4 text-purple-500" />}
            loading={isLoading}
          />
        )
      case 'impostoVendas':
        return (
          <SummaryKpiCard
            title="Imposto"
            value={formatCurrency(data?.impostoVendas ?? 0)}
            subtitle={
              typeof data?.salesTaxRate === 'number'
                ? `${data.salesTaxRate}% s/ Faturamento`
                : 'Simples / NF'
            }
            tooltip="Imposto sobre o faturamento deduzido do Lucro Líquido Real"
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
            loading={isLoading}
          />
        )
      case 'impostoMeta':
        return (
          <SummaryKpiCard
            title="Imposto Meta Ads"
            value={formatCurrency(data?.impostoMeta ?? 0)}
            subtitle={
              typeof data?.metaAdsTaxRate === 'number'
                ? `${data.metaAdsTaxRate}% s/ Anúncios`
                : 'Taxa s/ Anúncios'
            }
            tooltip={`Tributação sobre o investimento em anúncios no Meta Ads (${
              data?.metaAdsTaxRate ?? 0
            }%). Deduzido do Lucro Líquido Real.`}
            icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
            loading={isLoading}
          />
        )
      case 'impostoTotal':
        return (
          <SummaryKpiCard
            title="Imposto Total"
            value={formatCurrency(data?.impostoTotal ?? 0)}
            subtitle="Total acumulado"
            tooltip="Soma dos impostos da operação deduzidos do Lucro Líquido Real"
            icon={<FileSpreadsheet className="w-4 h-4 text-slate-500" />}
            loading={isLoading}
          />
        )
      case 'roi':
        return (
          <SummaryKpiCard
            title="ROI"
            value={formatPercent(data?.roi || 0)}
            subtitle="Retorno sobre investimento"
            tooltip="Percentual de retorno sobre o capital total investido (anúncios + impostos + taxas + despesas)"
            variant={(data?.roi || 0) >= 0 ? 'positive' : 'negative'}
            icon={<Percent className="w-4 h-4 text-blue-500" />}
            loading={isLoading}
          />
        )
      case 'roas':
        return (
          <SummaryKpiCard
            title="ROAS"
            value={formatMetric(data?.roas, 'ratio')}
            subtitle={
              data?.realRoas && data.realRoas !== data.roas
                ? `ROAS Real: ${formatMetric(data.realRoas, 'ratio')}`
                : 'Faturamento / Gasto'
            }
            tooltip={`Retorno sobre gastos com anúncios.${
              data?.realRoas
                ? ` ROAS Real (considerando imposto do Meta): ${formatMetric(data.realRoas, 'ratio')}.`
                : ''
            }`}
            variant={(data?.roas || 0) >= 2 ? 'positive' : 'neutral'}
            icon={<Target className="w-4 h-4 text-purple-500" />}
            loading={isLoading}
          />
        )
      case 'cpa':
        return (
          <SummaryKpiCard
            title="CPA"
            value={data?.cpa ? formatCurrency(data.cpa) : '—'}
            subtitle="Custo por Aquisição"
            tooltip="Custo médio gasto em anúncios para realizar cada venda aprovada"
            icon={<ShoppingBag className="w-4 h-4 text-cyan-500" />}
            loading={isLoading}
          />
        )
      case 'margin':
        return (
          <SummaryKpiCard
            title="Margem"
            value={formatPercent(data?.margin || 0)}
            subtitle="Lucro / Faturamento"
            tooltip="Percentual de rentabilidade líquida retido sobre o faturamento bruto"
            variant={(data?.margin || 0) >= 20 ? 'positive' : 'neutral'}
            icon={<Percent className="w-4 h-4 text-emerald-500" />}
            loading={isLoading}
          />
        )
      case 'arpu':
        return (
          <SummaryKpiCard
            title="Ticket Médio (ARPU)"
            value={formatCurrency(data?.arpu || data?.ticketMedio || 0)}
            subtitle="Média por venda aprovada"
            tooltip="Faturamento bruto dividido pela quantidade de vendas confirmadas"
            icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
            loading={isLoading}
          />
        )
      case 'refunds':
        return (
          <SummaryKpiCard
            title="Vendas Reembolsadas"
            value={data?.refundCount || 0}
            subtitle={formatCurrency(data?.refundAmount || 0)}
            tooltip="Quantidade de pedidos devolvidos aos compradores"
            variant={(data?.refundCount || 0) > 0 ? 'negative' : 'neutral'}
            icon={<RotateCcw className="w-4 h-4 text-rose-500" />}
            loading={isLoading}
          />
        )
      case 'taxaReembolso':
        return (
          <SummaryKpiCard
            title="Taxa de Reembolso"
            value={`${data?.taxaReembolso || 0}%`}
            subtitle={`${data?.refundCount || 0} devoluções`}
            tooltip="Percentual de devoluções sobre o volume total de pedidos"
            variant={(data?.taxaReembolso || 0) > 5 ? 'negative' : 'neutral'}
            icon={<RotateCcw className="w-4 h-4 text-rose-500" />}
            loading={isLoading}
          />
        )
      case 'chargebacks':
        return (
          <SummaryKpiCard
            title="Vendas Chargeback"
            value={data?.chargebackCount || 0}
            subtitle={formatCurrency(data?.chargebackAmount || 0)}
            tooltip="Contestações de compra abertas junto às operadoras de cartão"
            variant={(data?.chargebackCount || 0) > 0 ? 'negative' : 'neutral'}
            icon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
            loading={isLoading}
          />
        )
      case 'taxaChargeback':
        return (
          <SummaryKpiCard
            title="Taxa de Chargeback"
            value={`${data?.taxaChargeback || 0}%`}
            subtitle={`${data?.chargebackCount || 0} contestações`}
            tooltip="Percentual de contestações abertas junto às operadoras sobre o total de pedidos"
            variant={(data?.taxaChargeback || 0) > 1 ? 'negative' : 'neutral'}
            icon={<ShieldAlert className="w-4 h-4 text-rose-600" />}
            loading={isLoading}
          />
        )
      case 'leads':
        return (
          <SummaryKpiCard
            title="Leads"
            value={formatNumber(data?.leadsCount || 0)}
            subtitle={data?.custoPorLead ? `CPL: ${formatCurrency(data.custoPorLead)}` : 'Sem custo calculado'}
            tooltip="Total de cadastros e contatos capturados pelos pixels e eventos"
            icon={<Users className="w-4 h-4 text-blue-500" />}
            loading={isLoading}
          />
        )
      case 'conversas':
        return (
          <SummaryKpiCard
            title="Conversas"
            value={formatNumber(data?.conversasCount || 0)}
            subtitle={data?.custoPorConversa ? `Custo: ${formatCurrency(data.custoPorConversa)}` : '—'}
            tooltip="Inícios de conversa e contatos via botões ou links rastreados"
            icon={<MessageSquare className="w-4 h-4 text-emerald-500" />}
            loading={isLoading}
          />
        )
      case 'cpl':
        return (
          <SummaryKpiCard
            title="Custo por Lead"
            value={data?.custoPorLead ? formatCurrency(data.custoPorLead) : '—'}
            subtitle="Gasto / Leads"
            tooltip="Custo médio em anúncios para aquisição de cada lead cadastrado"
            icon={<Users className="w-4 h-4 text-blue-400" />}
            loading={isLoading}
          />
        )
      case 'cpc_conversa':
        return (
          <SummaryKpiCard
            title="Custo por Conversa"
            value={data?.custoPorConversa ? formatCurrency(data.custoPorConversa) : '—'}
            subtitle="Gasto / Conversas"
            tooltip="Custo médio em anúncios para gerar cada conversa ou contato"
            icon={<MessageSquare className="w-4 h-4 text-emerald-500" />}
            loading={isLoading}
          />
        )
      case 'cpc':
        return (
          <SummaryKpiCard
            title="CPC"
            value={data?.cpc ? formatCurrency(data.cpc) : '—'}
            subtitle="Custo por Clique"
            tooltip="Gasto médio em anúncios para cada clique gerado"
            icon={<Target className="w-4 h-4 text-blue-500" />}
            loading={isLoading}
          />
        )
      case 'cpm':
        return (
          <SummaryKpiCard
            title="CPM"
            value={data?.cpm ? formatCurrency(data.cpm) : '—'}
            subtitle="Custo p/ 1.000 visualizações"
            tooltip="Gasto médio para cada 1.000 impressões dos anúncios"
            icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
            loading={isLoading}
          />
        )
      case 'ctr':
        return (
          <SummaryKpiCard
            title="CTR"
            value={data?.ctr ? `${formatNumber(data.ctr)}%` : '—'}
            subtitle="Taxa de Cliques"
            tooltip="Percentual de impressões que resultaram em cliques"
            icon={<Percent className="w-4 h-4 text-purple-500" />}
            loading={isLoading}
          />
        )
      case 'cpi':
        return (
          <SummaryKpiCard
            title="CPI"
            value={data?.cpi ? formatCurrency(data.cpi) : '—'}
            subtitle="Custo por Checkout"
            tooltip="Custo médio em tráfego por início de finalização de compra"
            icon={<ShoppingBag className="w-4 h-4 text-cyan-500" />}
            loading={isLoading}
          />
        )
      default:
        return null
    }
  }

  const adAccounts = data?.adAccounts || []
  const activeWidgetsCount = Object.values(visibleWidgets).filter(Boolean).length

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* 1. Header com Título, Seletor de Período e Botão Personalizar Quadros */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Geral da Operação</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consolidação analítica de tráfego, anúncios, checkouts, vendas e rentabilidade
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor Rápido de Layouts Pré-definidos */}
            <div className="flex items-center bg-slate-100 dark:bg-[#061224] p-1 rounded-xl border border-slate-200 dark:border-[#142C52] text-xs">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 hidden lg:inline">
                Layout:
              </span>
              <div className="flex items-center gap-1">
                {PREDEFINED_LAYOUTS.map((layout) => {
                  const isSelected = activeLayout === layout.id
                  return (
                    <button
                      key={layout.id}
                      onClick={() => handleApplyPresetDirect(layout.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-white dark:bg-[#0E2547] text-blue-600 dark:text-blue-400 shadow-sm font-bold border border-slate-200/80 dark:border-blue-900/60'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title={layout.description}
                    >
                      <span>{layout.icon}</span>
                      <span className="hidden sm:inline">{layout.shortName}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <PeriodSelector
              value={period.preset}
              onChange={(preset, from, to) => setPeriod({ preset, from, to, label: preset })}
            />

            {/* Botão Personalizar Quadros estilo UTMFY */}
            <button
              onClick={() => setIsCustomizeModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl shadow-sm transition-all"
              title="Personalizar quais quadros aparecem na tela"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Personalizar Quadros</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-mono">
                {activeWidgetsCount}
              </span>
            </button>

            {/* Botão Mover / Reorganizar Cards */}
            <button
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border shadow-sm transition-all ${
                isReorderMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 font-bold shadow-md ring-2 ring-amber-300 dark:ring-amber-800'
                  : 'bg-white hover:bg-slate-50 dark:bg-[#081A33] dark:hover:bg-[#142C52] border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-300'
              }`}
              title={isReorderMode ? 'Concluir reorganização de posição' : 'Mover e trocar posição dos cards'}
            >
              {isReorderMode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluir Ordem</span>
                </>
              ) : (
                <>
                  <Move className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mover Cards</span>
                </>
              )}
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] shadow-sm transition-colors disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros Operacionais */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl shadow-sm text-xs">
          {/* Filtro: Conta de Anúncios */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Conta:</span>
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas as Contas</option>
              {adAccounts.map((acc: { id: string; name: string; externalId: string }) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.externalId})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: Plataforma */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Plataforma:</span>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas as Plataformas</option>
              <option value="hotmart">Hotmart</option>
              <option value="kiwify">Kiwify</option>
              <option value="getfy">Getfy</option>
              <option value="cakto">Cakto</option>
              <option value="yampi">Yampi</option>
              <option value="shopify">Shopify</option>
              <option value="generic">Genérico</option>
            </select>
          </div>

          {/* Filtro: Fonte de Tráfego */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Fonte:</span>
            <select
              value={selectedTrafficSource}
              onChange={(e) => setSelectedTrafficSource(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas as Fontes</option>
              <option value="facebook">Facebook / Meta Ads</option>
              <option value="instagram">Instagram</option>
              <option value="google">Google Ads</option>
              <option value="tiktok">TikTok</option>
              <option value="organico">Orgânico</option>
            </select>
          </div>

          {/* Botão Mais Filtros */}
          <button
            onClick={() => setIsMoreFiltersOpen(!isMoreFiltersOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-[#142C52]/60 transition-colors ml-auto"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Mais Filtros</span>
          </button>
        </div>

        {isMoreFiltersOpen && (
          <div className="p-4 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs flex flex-wrap items-center gap-4 animate-in fade-in">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 mb-1">Filtrar por Produto:</label>
              <input
                type="text"
                placeholder="Nome ou SKU do Produto..."
                value={selectedProduct === 'all' ? '' : selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value || 'all')}
                className="px-3 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs w-64"
              />
            </div>
            <button
              onClick={() => {
                setSelectedAdAccount('all')
                setSelectedPlatform('all')
                setSelectedTrafficSource('all')
                setSelectedProduct('all')
              }}
              className="px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 mt-4"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Barra de Ajuda / Ações do Modo Reorganização */}
      {isReorderMode && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="font-bold">Modo de Reorganização Ativo:</span>
            <span>
              Arraste e solte qualquer card sobre outro para trocar de posição, ou use os botões ◀ ▶ nos cantos dos cards.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetKpiOrder}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50 font-medium transition-all"
            >
              Restaurar Ordem Padrão
            </button>
            <button
              onClick={() => setIsReorderMode(false)}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all shadow-sm"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* 2. Grade de Indicadores Personalizáveis Reordenáveis (Cards estilo UTMFY) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {kpiOrder.map((id, index) => {
          if (visibleWidgets[id] === false) return null
          const cardContent = renderKpiCard(id)
          if (!cardContent) return null

          return (
            <div
              key={id}
              draggable={isReorderMode}
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
              className={`relative transition-all duration-150 ${
                isReorderMode
                  ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02] ring-2 ring-dashed ring-amber-400 dark:ring-amber-500 rounded-xl'
                  : ''
              } ${draggingId === id ? 'opacity-30 scale-95' : ''} ${
                dropTargetId === id ? 'ring-2 ring-blue-500 scale-[1.02] rounded-xl' : ''
              }`}
            >
              {cardContent}
              {isReorderMode && (
                <div className="absolute top-2 right-2 flex items-center gap-1 z-20 bg-white/95 dark:bg-black/95 px-1.5 py-0.5 rounded-md shadow border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => handleMoveStep(id, -1)}
                    disabled={index === 0}
                    className="text-slate-500 hover:text-blue-600 disabled:opacity-30 text-[10px] p-0.5 font-bold"
                    title="Mover para a esquerda"
                  >
                    ◀
                  </button>
                  <GripVertical className="w-3 h-3 text-amber-500 cursor-grab" />
                  <button
                    onClick={() => handleMoveStep(id, 1)}
                    disabled={index === kpiOrder.length - 1}
                    className="text-slate-500 hover:text-blue-600 disabled:opacity-30 text-[10px] p-0.5 font-bold"
                    title="Mover para a direita"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 3. Vendas / Dia (Evolução Diária do Calendário) */}
      {visibleWidgets.dailyChart !== false && (
        <DailySalesCard data={data?.dailyChartData} loading={isLoading} />
      )}

      {/* 4. Vendas por Dia da Semana (Novo Quadro UTMFY) */}
      {visibleWidgets.weekdaySales !== false && (
        <WeekdaySalesCard data={data?.weekdayData} loading={isLoading} />
      )}

      {/* 5. Funil de Conversão (Meta Ads) */}
      {visibleWidgets.funnel !== false && (
        <ConversionFunnel data={data?.funnel} loading={isLoading} />
      )}

      {/* 5. Vendas & Faturamento por Produto (Novo Quadro UTMFY) */}
      {visibleWidgets.productSales !== false && (
        <ProductSalesCard products={data?.productDistribution} loading={isLoading} />
      )}

      {/* 6. Gráficos Temporais 24h: Faturamento x Investimento x Lucro & Lucro por Horário */}
      {(visibleWidgets.hourlyRevenueChart !== false || visibleWidgets.hourlyProfitChart !== false) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visibleWidgets.hourlyRevenueChart !== false && (
            <HourlyRevenueChart data={data?.hourlyData} loading={isLoading} />
          )}
          {visibleWidgets.hourlyProfitChart !== false && (
            <HourlyProfitChart data={data?.hourlyData} loading={isLoading} />
          )}
        </div>
      )}

      {/* 7. Vendas por Pagamento (Pix, Cartão, Boleto) & Vendas por SRC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visibleWidgets.paymentMethods !== false && (
          <PaymentMethodsCard data={data?.paymentDistribution} loading={isLoading} />
        )}
        {visibleWidgets.srcDistribution !== false && (
          <SrcDistributionCard data={data?.srcDistribution} loading={isLoading} />
        )}
      </div>

      {/* 8. Vendas por País & Distribuição por Origem / Plataforma */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {visibleWidgets.salesByCountry !== false && (
          <div className="lg:col-span-1">
            <SalesByCountry data={data?.countryDistribution} loading={isLoading} />
          </div>
        )}
        {visibleWidgets.sourceDistribution !== false && (
          <div className={visibleWidgets.salesByCountry !== false ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <SourceDistributionCard
              sources={data?.sourceDistribution}
              platforms={data?.platformDistribution}
              loading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Modal de Personalização dos Quadros */}
      <CustomizeWidgetsModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        visibleWidgets={visibleWidgets}
        activeLayout={activeLayout}
        onSave={handleSaveWidgets}
      />
    </div>
  )
}
