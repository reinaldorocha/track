'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts'
import {
  Clock,
  Sparkles,
  TrendingUp,
  CreditCard,
  QrCode,
  DollarSign,
  Percent,
  Calendar,
  Filter,
  RefreshCw,
  Award,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface HourlyBucket {
  hour: number
  label: string
  shortLabel: string
  grossRevenue: number
  netRevenue: number
  approvedCount: number
  pendingCount: number
  refundedCount: number
  totalOrders: number
  pixCount: number
  cardCount: number
  boletoCount: number
  otherMethodCount: number
  avgTicket: number
  approvalRate: number
}

interface HourlyApiResponse {
  success: boolean
  timeZone: string
  period: { from: string; to: string }
  summary: {
    totalGross: number
    totalNet: number
    totalApprovedCount: number
    totalPendingCount: number
    totalRefundedCount: number
    totalPixCount: number
    totalCardCount: number
    overallApprovalRate: number
    goldenHour: {
      bestHour: number
      bestHourLabel: string
      bestHourRevenue: number
      peakOrdersHour: number
      peakOrdersHourLabel: string
      peakPixHour: number
      peakPixHourLabel: string
      peakCardHour: number
      peakCardHourLabel: string
    }
  }
  hourly: HourlyBucket[]
}

interface HourlySalesBreakdownProps {
  initialPlatform?: string
}

export function HourlySalesBreakdown({ initialPlatform = 'all' }: HourlySalesBreakdownProps) {
  const [periodPreset, setPeriodPreset] = useState<'today' | 'yesterday' | 'last7days' | 'last30days'>('last7days')
  const [platform, setPlatform] = useState<string>(initialPlatform)
  const [metricMode, setMetricMode] = useState<'revenue' | 'orders' | 'methods' | 'approvalRate'>('revenue')

  // Calcular limites de data baseados no preset
  const getDateRange = () => {
    const now = new Date()
    let from = new Date()
    let to = new Date()

    if (periodPreset === 'today') {
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
    } else if (periodPreset === 'yesterday') {
      from.setDate(now.getDate() - 1)
      from.setHours(0, 0, 0, 0)
      to.setDate(now.getDate() - 1)
      to.setHours(23, 59, 59, 999)
    } else if (periodPreset === 'last7days') {
      from.setDate(now.getDate() - 7)
    } else if (periodPreset === 'last30days') {
      from.setDate(now.getDate() - 30)
    }

    return { from: from.toISOString(), to: to.toISOString() }
  }

  const { from, to } = getDateRange()

  const { data, isLoading, refetch, isFetching } = useQuery<HourlyApiResponse>({
    queryKey: ['hourly-sales', periodPreset, platform],
    queryFn: async () => {
      const params = new URLSearchParams({
        from,
        to,
        platform,
      })
      const res = await fetch(`/api/sales/hourly?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar dados horários')
      return res.json()
    },
  })

  const summary = data?.summary
  const hourly = data?.hourly || []
  const bestHour = summary?.goldenHour?.bestHour ?? -1

  // Formatador do Tooltip do Gráfico
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const bucket: HourlyBucket = payload[0]?.payload
      return (
        <div className="bg-slate-900 dark:bg-black/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[210px] text-white">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              {label} (24h)
            </span>
            {bucket?.hour === bestHour && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded font-bold border border-amber-500/30">
                🌟 Golden Hour
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Faturamento:</span>
              <span className="font-bold text-emerald-400 font-mono">{formatCurrency(bucket?.grossRevenue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Aprovados:</span>
              <span className="font-semibold text-white">{bucket?.approvedCount} pedidos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pendentes (Pix/Boleto):</span>
              <span className="font-semibold text-sky-300">{bucket?.pendingCount} pedidos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pix Gerados:</span>
              <span className="font-semibold text-emerald-300">{bucket?.pixCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cartão de Crédito:</span>
              <span className="font-semibold text-indigo-300">{bucket?.cardCount}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-400">Taxa de Aprovação:</span>
              <span className="font-bold text-white">{bucket?.approvalRate}%</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header & Filtros */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-900">
              <Clock className="w-3.5 h-3.5" />
              Distribuição 24h &amp; Golden Hour
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Vendas por Hora do Dia
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Descubra os horários de maior conversão, pico de geração de Pix vs Cartão de Crédito e otimize o orçamento das suas campanhas Meta Ads.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Presets de Período */}
            <div className="inline-flex bg-slate-100 dark:bg-[#061224] p-1 rounded-xl border border-slate-200 dark:border-[#142C52] text-xs">
              <button
                onClick={() => setPeriodPreset('today')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  periodPreset === 'today'
                    ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => setPeriodPreset('yesterday')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  periodPreset === 'yesterday'
                    ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Ontem
              </button>
              <button
                onClick={() => setPeriodPreset('last7days')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  periodPreset === 'last7days'
                    ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Últimos 7 dias
              </button>
              <button
                onClick={() => setPeriodPreset('last30days')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  periodPreset === 'last30days'
                    ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                30 dias
              </button>
            </div>

            {/* Plataforma Selector */}
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Todas Plataformas</option>
              <option value="kiwify">Kiwify</option>
              <option value="hotmart">Hotmart</option>
              <option value="cakto">Cakto</option>
              <option value="getfy">Getfy</option>
              <option value="yampi">Yampi</option>
              <option value="shopify">Shopify</option>
            </select>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 border border-slate-200 dark:border-[#142C52] rounded-xl hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300 transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Cards de Destaque / Golden Hour */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Melhor Horário (Golden Hour) */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              Golden Hour (Faturamento)
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {summary?.goldenHour?.bestHourLabel || '00:00 - 00:59'}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Faturado no horário:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(summary?.goldenHour?.bestHourRevenue || 0)}
            </span>
          </div>
        </div>

        {/* Pico de Volume (Pedidos) */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Pico de Pedidos Aprovados
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {summary?.goldenHour?.peakOrdersHourLabel || '00:00 - 00:59'}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Total aprovados:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {summary?.totalApprovedCount || 0} pedidos no período
            </span>
          </div>
        </div>

        {/* Pico de Pix */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-emerald-500" />
            Pico de Pix Gerados
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {summary?.goldenHour?.peakPixHourLabel || '00:00 - 00:59'}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Total Pix gerados:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {summary?.totalPixCount || 0} ordens
            </span>
          </div>
        </div>

        {/* Pico de Cartão de Crédito */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            Pico de Cartão de Crédito
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {summary?.goldenHour?.peakCardHourLabel || '00:00 - 00:59'}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>Aprovação média:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {summary?.overallApprovalRate || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico 24 Horas Interativo */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Curva de Vendas de 00:00 às 23:00</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#142C52] text-slate-600 dark:text-slate-300 font-normal">
                Fuso: {data?.timeZone || 'América/São Paulo'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              A barra em destaque dourado indica a sua Golden Hour com maior faturamento
            </p>
          </div>

          {/* Toggle de Métricas do Gráfico */}
          <div className="inline-flex bg-slate-100 dark:bg-[#061224] p-1 rounded-xl border border-slate-200 dark:border-[#142C52] text-xs">
            <button
              onClick={() => setMetricMode('revenue')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'revenue'
                  ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Faturamento (R$)
            </button>
            <button
              onClick={() => setMetricMode('orders')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'orders'
                  ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Pedidos Aprovados
            </button>
            <button
              onClick={() => setMetricMode('methods')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'methods'
                  ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Pix vs Cartão
            </button>
            <button
              onClick={() => setMetricMode('approvalRate')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                metricMode === 'approvalRate'
                  ? 'bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Taxa Aprovação (%)
            </button>
          </div>
        </div>

        {/* Gráfico Recharts */}
        <div className="h-72 w-full pt-2">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando distribuição horária...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#888888' }}
                  axisLine={{ stroke: '#444444', opacity: 0.2 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#888888' }}
                  axisLine={{ stroke: '#444444', opacity: 0.2 }}
                  tickLine={false}
                  tickFormatter={(val) =>
                    metricMode === 'revenue'
                      ? `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                      : metricMode === 'approvalRate'
                      ? `${val}%`
                      : String(val)
                  }
                />
                <Tooltip content={<CustomTooltip />} />

                {metricMode === 'revenue' && (
                  <Bar dataKey="grossRevenue" name="Faturamento" radius={[4, 4, 0, 0]}>
                    {hourly.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.hour === bestHour && entry.grossRevenue > 0 ? '#F59E0B' : '#3B82F6'}
                      />
                    ))}
                  </Bar>
                )}

                {metricMode === 'orders' && (
                  <Bar dataKey="approvedCount" name="Pedidos Aprovados" fill="#10B981" radius={[4, 4, 0, 0]}>
                    {hourly.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.hour === summary?.goldenHour?.peakOrdersHour && entry.approvedCount > 0 ? '#F59E0B' : '#10B981'}
                      />
                    ))}
                  </Bar>
                )}

                {metricMode === 'methods' && (
                  <>
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="pixCount" name="Pix" fill="#10B981" stackId="methods" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="cardCount" name="Cartão de Crédito" fill="#6366F1" stackId="methods" radius={[4, 4, 0, 0]} />
                  </>
                )}

                {metricMode === 'approvalRate' && (
                  <Bar dataKey="approvalRate" name="Taxa de Aprovação (%)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabela Detalhada Hora a Hora (00:00 às 23:00) */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-[#142C52] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Tabela Detalhada Hora a Hora (24 Horas)
          </h3>
          <span className="text-xs text-slate-400">
            Total do período: <strong className="text-emerald-500 font-mono">{formatCurrency(summary?.totalGross || 0)}</strong> ({summary?.totalApprovedCount || 0} vendas)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-[#061224] text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-[#142C52]">
              <tr>
                <th className="py-3 px-4">Horário</th>
                <th className="py-3 px-4 text-right">Faturamento Bruto</th>
                <th className="py-3 px-4 text-right">Líquido</th>
                <th className="py-3 px-4 text-center">Aprovados</th>
                <th className="py-3 px-4 text-center">Pendentes (Pix/Boleto)</th>
                <th className="py-3 px-4 text-center">Pix</th>
                <th className="py-3 px-4 text-center">Cartão</th>
                <th className="py-3 px-4 text-right">Ticket Médio</th>
                <th className="py-3 px-4 text-right">Taxa Aprovação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52] text-slate-700 dark:text-slate-300">
              {hourly.map((b) => {
                const isChampion = b.hour === bestHour && b.grossRevenue > 0
                return (
                  <tr
                    key={b.hour}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-[#0d223f] ${
                      isChampion ? 'bg-amber-500/10 font-medium' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{b.label}</span>
                        {isChampion && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-slate-950 font-bold uppercase tracking-wider">
                            🌟 Golden Hour
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(b.grossRevenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatCurrency(b.netRevenue)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {b.approvedCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                          {b.approvedCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {b.pendingCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                          {b.pendingCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300 font-mono">
                      {b.pixCount}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300 font-mono">
                      {b.cardCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {formatCurrency(b.avgTicket)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(b.approvalRate, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold text-[11px] w-9">
                          {b.approvalRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
