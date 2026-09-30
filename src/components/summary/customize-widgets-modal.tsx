'use client'

import React, { useState } from 'react'
import {
  Sliders,
  X,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Search,
  Sparkles,
} from 'lucide-react'

export interface WidgetDefinition {
  id: string
  title: string
  description: string
  category: 'Geral' | 'Tráfego' | 'Perdas' | 'Impostos' | 'WhatsApp' | 'Gráficos' | 'Produtos'
  defaultVisible: boolean
}

export const ALL_WIDGETS: WidgetDefinition[] = [
  // 1. Geral
  { id: 'grossRevenue', title: 'Faturamento Bruto', description: 'Receita total antes de taxas e deduções', category: 'Geral', defaultVisible: true },
  { id: 'adSpend', title: 'Gastos com Anúncios', description: 'Investimento total sincronizado do Meta Ads', category: 'Geral', defaultVisible: true },
  { id: 'profit', title: 'Lucro Real', description: 'Lucro líquido deduzindo anúncios, taxas, despesas e impostos', category: 'Geral', defaultVisible: true },
  { id: 'netRevenue', title: 'Faturamento Líquido', description: 'Receita após desconto das taxas de gateway', category: 'Geral', defaultVisible: true },
  { id: 'pending', title: 'Vendas Pendentes', description: 'Pedidos com Pix gerado ou boleto aguardando', category: 'Geral', defaultVisible: true },
  { id: 'roi', title: 'ROI', description: 'Retorno percentual sobre o capital total investido', category: 'Geral', defaultVisible: true },
  { id: 'roas', title: 'ROAS', description: 'Retorno sobre gasto com anúncios e ROAS Real', category: 'Geral', defaultVisible: true },
  { id: 'cpa', title: 'CPA', description: 'Custo médio por venda aprovada', category: 'Geral', defaultVisible: true },
  { id: 'margin', title: 'Margem de Lucro', description: 'Percentual de retenção líquida sobre faturamento', category: 'Geral', defaultVisible: true },
  { id: 'arpu', title: 'Ticket Médio (ARPU)', description: 'Média de receita por cliente ou pedido aprovado', category: 'Geral', defaultVisible: true },

  // 2. Tráfego & Métricas Unitárias
  { id: 'cpc', title: 'CPC (Custo por Clique)', description: 'Custo médio pago por clique nos anúncios', category: 'Tráfego', defaultVisible: false },
  { id: 'cpm', title: 'CPM (Custo por Mil)', description: 'Custo por cada 1.000 impressões no Meta Ads', category: 'Tráfego', defaultVisible: false },
  { id: 'ctr', title: 'CTR (Taxa de Cliques)', description: 'Percentual de cliques sobre visualizações', category: 'Tráfego', defaultVisible: false },
  { id: 'cpi', title: 'CPI (Custo por Checkout)', description: 'Custo médio por início de finalização de compra', category: 'Tráfego', defaultVisible: false },

  // 3. Perdas & Reembolsos
  { id: 'refunds', title: 'Vendas Reembolsadas', description: 'Quantidade e valor financeiro de pedidos estornados', category: 'Perdas', defaultVisible: true },
  { id: 'chargebacks', title: 'Vendas Chargeback', description: 'Contestações abertas junto a operadoras de cartão', category: 'Perdas', defaultVisible: true },
  { id: 'taxaReembolso', title: 'Taxa de Reembolso (%)', description: 'Percentual de devoluções sobre o total de vendas', category: 'Perdas', defaultVisible: true },
  { id: 'taxaChargeback', title: 'Taxa de Chargeback (%)', description: 'Percentual de contestações sobre o total de vendas', category: 'Perdas', defaultVisible: true },

  // 4. Impostos & Taxas
  { id: 'fees', title: 'Taxas de Checkout', description: 'Custos operacionais dos gateways (Kiwify, Hotmart, etc.)', category: 'Impostos', defaultVisible: true },
  { id: 'expenses', title: 'Despesas', description: 'Custos fixos e despesas extras operacionais deduzidos do Lucro Real', category: 'Impostos', defaultVisible: true },
  { id: 'impostoVendas', title: 'Imposto', description: 'Imposto sobre faturamento com alíquota configurada (Simples Nacional / NF)', category: 'Impostos', defaultVisible: true },
  { id: 'impostoMeta', title: 'Imposto Meta Ads', description: 'Tributação calculada sobre o investimento em tráfego', category: 'Impostos', defaultVisible: false },
  { id: 'impostoTotal', title: 'Imposto Total', description: 'Soma total dos impostos da operação', category: 'Impostos', defaultVisible: false },

  // 5. WhatsApp & Leads
  { id: 'leads', title: 'Leads Capturados', description: 'Cadastros e contatos capturados pelos pixels', category: 'WhatsApp', defaultVisible: true },
  { id: 'conversas', title: 'Conversas WhatsApp', description: 'Cliques e interações em botões de conversa rastreados', category: 'WhatsApp', defaultVisible: true },
  { id: 'cpl', title: 'Custo por Lead (CPL)', description: 'Custo em anúncios para capturar cada lead', category: 'WhatsApp', defaultVisible: true },
  { id: 'cpc_conversa', title: 'Custo por Conversa', description: 'Custo médio em tráfego por conversa iniciada', category: 'WhatsApp', defaultVisible: true },

  // 6. Gráficos Avançados
  { id: 'funnel', title: 'Funil de Conversão', description: 'Etapas de tráfego, pageviews, checkouts e vendas com drop-off', category: 'Gráficos', defaultVisible: true },
  { id: 'dailyChart', title: 'Vendas / Dia (Evolução Diária)', description: 'Gráfico diário de faturamento x investimento x lucro no calendário', category: 'Gráficos', defaultVisible: true },
  { id: 'weekdaySales', title: 'Vendas por Dia da Semana', description: 'Distribuição e performance comparativa de vendas e faturamento de Segunda a Domingo', category: 'Gráficos', defaultVisible: true },
  { id: 'hourlyRevenueChart', title: 'Faturamento x Investimento por Hora', description: 'Distribuição e evolução horária nas 24h do dia', category: 'Gráficos', defaultVisible: true },
  { id: 'hourlyProfitChart', title: 'Lucro por Horário (24h)', description: 'Lucro horário líquido gerado ao longo do dia', category: 'Gráficos', defaultVisible: true },
  { id: 'paymentMethods', title: 'Vendas por Forma de Pagamento', description: 'Distribuição de Pix vs Cartão vs Boleto e aprovações', category: 'Gráficos', defaultVisible: true },
  { id: 'salesByCountry', title: 'Vendas por País', description: 'Mapa e ranking geográfico das compras por país', category: 'Gráficos', defaultVisible: true },
  { id: 'sourceDistribution', title: 'Vendas por Origem (UTM Source)', description: 'Divisão por canais Facebook, Instagram, Google, etc.', category: 'Gráficos', defaultVisible: true },

  // 7. Produtos & Sub-Origens
  { id: 'productSales', title: 'Vendas / Faturamento por Produto', description: 'Ranking e tabela detalhada de faturamento por produto', category: 'Produtos', defaultVisible: true },
  { id: 'srcDistribution', title: 'Vendas por SRC (Sub-origem)', description: 'Distribuição de pedidos pelo parâmetro src', category: 'Produtos', defaultVisible: true },
]

export const DEFAULT_VISIBLE_WIDGETS = ALL_WIDGETS.reduce<Record<string, boolean>>((acc, w) => {
  acc[w.id] = w.defaultVisible
  return acc
}, {})

export const WIDGET_CATALOG = ALL_WIDGETS

export interface PredefinedLayout {
  id: string
  name: string
  shortName: string
  description: string
  icon: string
  badge?: string
  widgets: Record<string, boolean>
}

export const PREDEFINED_LAYOUTS: PredefinedLayout[] = [
  {
    id: 'basico',
    name: 'Básico (Essencial)',
    shortName: 'Básico',
    description: 'Faturamento bruto, líquido, gasto Meta Ads, taxas gateway, despesas, imposto e lucro real',
    icon: '⚡',
    badge: 'Recomendado',
    widgets: {
      grossRevenue: true,
      netRevenue: true,
      adSpend: true,
      profit: true,
      fees: true,
      expenses: true,
      impostoVendas: true,
      impostoMeta: true,
      roas: true,
      roi: true,
      pending: true,
      arpu: true,
      dailyChart: true,
      weekdaySales: true,
      productSales: true,
      paymentMethods: true,
    },
  },
  {
    id: 'completo',
    name: 'Completo (Visão 360°)',
    shortName: 'Completo',
    description: 'Todos os quadros, gráficos avançados, métricas de tráfego e perdas ativados',
    icon: '📊',
    widgets: ALL_WIDGETS.reduce<Record<string, boolean>>((acc, w) => {
      acc[w.id] = true
      return acc
    }, {}),
  },
  {
    id: 'trafego',
    name: 'Tráfego & Media Buyer',
    shortName: 'Tráfego',
    description: 'Foco em campanhas: ROAS, CPA, CPC, CPM, CTR, CPI, Imposto de Anúncios, Funil e Vendas por Horário/SRC',
    icon: '🎯',
    widgets: {
      grossRevenue: true,
      adSpend: true,
      impostoMeta: true,
      roas: true,
      cpa: true,
      margin: true,
      cpc: true,
      cpm: true,
      ctr: true,
      cpi: true,
      funnel: true,
      dailyChart: true,
      weekdaySales: true,
      hourlyRevenueChart: true,
      hourlyProfitChart: true,
      sourceDistribution: true,
      srcDistribution: true,
      productSales: true,
    },
  },
  {
    id: 'financeiro',
    name: 'Financeiro & Margens',
    shortName: 'Financeiro',
    description: 'Foco em lucro líquido, margem, taxas de gateway, despesas, impostos e controle de perdas',
    icon: '💰',
    widgets: {
      grossRevenue: true,
      netRevenue: true,
      profit: true,
      margin: true,
      roi: true,
      pending: true,
      arpu: true,
      fees: true,
      expenses: true,
      impostoVendas: true,
      impostoTotal: true,
      refunds: true,
      taxaReembolso: true,
      chargebacks: true,
      taxaChargeback: true,
      dailyChart: true,
      weekdaySales: true,
      paymentMethods: true,
      productSales: true,
    },
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp & Leads',
    shortName: 'WhatsApp',
    description: 'Foco em captação de leads, conversas iniciadas, custo por contato e fechamento X1',
    icon: '💬',
    widgets: {
      grossRevenue: true,
      adSpend: true,
      profit: true,
      roas: true,
      cpa: true,
      leads: true,
      conversas: true,
      cpl: true,
      cpc_conversa: true,
      funnel: true,
      dailyChart: true,
      weekdaySales: true,
      srcDistribution: true,
      productSales: true,
      paymentMethods: true,
    },
  },
]

export function getLayoutWidgets(layoutId: string): Record<string, boolean> {
  const found = PREDEFINED_LAYOUTS.find((l) => l.id === layoutId)
  if (found) {
    const result: Record<string, boolean> = {}
    for (const w of ALL_WIDGETS) {
      result[w.id] = Boolean(found.widgets[w.id])
    }
    return result
  }
  return DEFAULT_VISIBLE_WIDGETS
}

interface CustomizeWidgetsModalProps {
  isOpen: boolean
  onClose: () => void
  visibleWidgets: Record<string, boolean>
  activeLayout?: string
  onSave: (newSettings: Record<string, boolean>, layoutId?: string) => void
}

export function CustomizeWidgetsModal({
  isOpen,
  onClose,
  visibleWidgets,
  activeLayout = 'custom',
  onSave,
}: CustomizeWidgetsModalProps) {
  const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({
    ...DEFAULT_VISIBLE_WIDGETS,
    ...visibleWidgets,
  })
  const [currentLayoutId, setCurrentLayoutId] = useState<string>(activeLayout)
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')
  const [searchTerm, setSearchTerm] = useState('')

  // Sincronizar quando abrir
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalSettings({ ...visibleWidgets })
    setCurrentLayoutId(activeLayout)
  }, [isOpen, visibleWidgets, activeLayout])

  if (!isOpen) return null

  const categories = ['Todas', 'Geral', 'Tráfego', 'Perdas', 'Impostos', 'WhatsApp', 'Gráficos', 'Produtos']

  const filteredWidgets = ALL_WIDGETS.filter((w) => {
    const matchesCategory = selectedCategory === 'Todas' || w.category === selectedCategory
    const matchesSearch =
      w.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      w.description.toLowerCase().includes(searchTerm.toLowerCase().trim())
    return matchesCategory && matchesSearch
  })

  const activeCount = Object.values(localSettings).filter(Boolean).length

  const handleSelectLayout = (layoutId: string) => {
    setCurrentLayoutId(layoutId)
    setLocalSettings(getLayoutWidgets(layoutId))
  }

  const handleToggle = (id: string) => {
    setCurrentLayoutId('custom')
    setLocalSettings((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleSelectAll = (value: boolean) => {
    setCurrentLayoutId('custom')
    const updated: Record<string, boolean> = {}
    for (const w of ALL_WIDGETS) {
      updated[w.id] = value
    }
    setLocalSettings(updated)
  }

  const handleReset = () => {
    handleSelectLayout('basico')
  }

  const handleApply = () => {
    onSave(localSettings, currentLayoutId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#142C52] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Personalizar Quadros da Dashboard
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {activeCount} de {ALL_WIDGETS.length} ativos
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione um layout pré-definido ou ative/desative quadros individualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#142C52] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Layouts Pré-definidos */}
        <div className="p-4 bg-slate-50/80 dark:bg-[#061224]/80 border-b border-slate-200 dark:border-[#142C52] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Layouts Pré-definidos:
            </span>
            {currentLayoutId === 'custom' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Modo Personalizado
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PREDEFINED_LAYOUTS.map((layout) => {
              const isSelected = currentLayoutId === layout.id
              return (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => handleSelectLayout(layout.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 dark:border-[#142C52] bg-white dark:bg-[#081A33] hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{layout.icon}</span>
                    {layout.badge && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {layout.badge}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-xs mt-1 truncate">{layout.shortName}</div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                    {layout.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Barra de Filtro e Busca */}
        <div className="p-4 bg-white dark:bg-[#081A33] border-b border-slate-200 dark:border-[#142C52] space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar quadros (ex: lucro, imposto, produto, cpa)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg font-semibold transition-colors"
              >
                Ativar Todos
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors"
              >
                Ocultar Todos
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors"
                title="Restaurar layout básico"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Padrão (Básico)
              </button>
            </div>
          </div>

          {/* Categorias Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-[#061224] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#142C52] hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Quadros com Toggles */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-[#142C52] space-y-1">
          {filteredWidgets.map((widget) => {
            const isVisible = localSettings[widget.id] ?? widget.defaultVisible
            return (
              <div
                key={widget.id}
                onClick={() => handleToggle(widget.id)}
                className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                  isVisible
                    ? 'bg-blue-50/30 dark:bg-blue-950/10 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                    : 'opacity-60 hover:opacity-90 hover:bg-slate-50 dark:hover:bg-[#0d223f]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg ${
                      isVisible
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {widget.title}
                      </p>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-[#142C52] text-slate-500 dark:text-slate-400 font-semibold">
                        {widget.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {widget.description}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isVisible ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer com Botões */}
        <div className="p-4 border-t border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Suas preferências ficam salvas automaticamente no navegador.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-colors"
            >
              <Check className="w-4 h-4" />
              Salvar e Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
