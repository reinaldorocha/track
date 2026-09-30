'use client'

import React, { useState, useMemo } from 'react'
import { CalendarDays, Trophy, BarChart2, Table } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

export interface WeekdaySaleItem {
  dayIndex: number
  name: string
  shortName: string
  salesCount: number
  grossRevenue: number
  netRevenue: number
  spend: number
  profit: number
  avgTicket: number
  percentage: number
  roas: number
}

interface WeekdaySalesCardProps {
  data?: WeekdaySaleItem[]
  loading?: boolean
}

export function WeekdaySalesCard({ data = [], loading = false }: WeekdaySalesCardProps) {
  // Padrão selecionado: Barras (mais compacto e visual)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  // Padrão fixo da semana: Segunda (1) a Sábado (6), depois Domingo (0)
  const orderedData = useMemo(() => {
    if (!data || data.length === 0) return []
    const copy = [...data]
    return copy.sort((a, b) => {
      const orderA = a.dayIndex === 0 ? 7 : a.dayIndex
      const orderB = b.dayIndex === 0 ? 7 : b.dayIndex
      return orderA - orderB
    })
  }, [data])

  const totalGross = orderedData.reduce((acc, d) => acc + (d.grossRevenue || 0), 0)
  const maxRevenue = Math.max(...orderedData.map((d) => d.grossRevenue || 0), 1)

  // Melhor dia em faturamento
  const bestRevenueDay = useMemo(() => {
    if (orderedData.length === 0 || totalGross === 0) return null
    return [...orderedData].sort((a, b) => b.grossRevenue - a.grossRevenue)[0]
  }, [orderedData, totalGross])

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* Cabeçalho Compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Vendas por Dia da Semana
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Seg → Dom
              </span>
              {bestRevenueDay && bestRevenueDay.grossRevenue > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300">
                  <Trophy className="w-3 h-3 text-amber-500" />
                  Melhor: <strong className="font-bold">{bestRevenueDay.name}</strong> ({formatCurrency(bestRevenueDay.grossRevenue)})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Comparativo de receita bruta, volume de pedidos e ticket médio
            </p>
          </div>
        </div>

        {/* Toggle Compacto de Visualização: Barras (padrão) ou Tabela */}
        <div className="flex items-center bg-slate-100 dark:bg-[#061224] p-1 rounded-lg border border-slate-200 dark:border-[#142C52] text-xs self-start sm:self-auto">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'chart'
                ? 'bg-white dark:bg-[#0E2547] text-indigo-600 dark:text-indigo-300 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
            title="Gráfico de Barras"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Barras</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'table'
                ? 'bg-white dark:bg-[#0E2547] text-indigo-600 dark:text-indigo-300 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
            title="Tabela Detalhada"
          >
            <Table className="w-3.5 h-3.5" />
            <span>Tabela</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400 animate-pulse">
          Carregando dados por dia da semana...
        </div>
      ) : orderedData.length === 0 || totalGross === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#142C52] rounded-xl">
          <CalendarDays className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Nenhuma venda no período selecionado
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            As vendas aprovadas serão consolidadas por dia da semana automaticamente.
          </p>
        </div>
      ) : viewMode === 'chart' ? (
        /* 1. VISÃO DE BARRAS ESBELTAS E COMPACTAS */
        <div className="bg-slate-50/70 dark:bg-[#061224]/70 border border-slate-200/80 dark:border-[#142C52] rounded-xl p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-3 items-end">
            {orderedData.map((item) => {
              const isBest = bestRevenueDay && bestRevenueDay.dayIndex === item.dayIndex && item.grossRevenue > 0
              const barPercent = maxRevenue > 0 ? (item.grossRevenue / maxRevenue) * 100 : 0

              return (
                <div
                  key={item.dayIndex}
                  className="flex flex-col items-center justify-end text-center group cursor-pointer"
                  title={`${item.name}
Faturamento: ${formatCurrency(item.grossRevenue)}
Vendas: ${item.salesCount} pedidos
Ticket Médio: ${formatCurrency(item.avgTicket)}
Participação: ${formatPercent(item.percentage, 2)}`}
                >
                  {/* Faturamento Acima da Barra */}
                  <div className="mb-1.5 min-h-[30px] flex flex-col items-center justify-end">
                    {isBest && (
                      <span className="px-1 py-0.2 rounded-full bg-amber-500 text-white text-[8px] sm:text-[9px] font-bold shadow-xs mb-0.5 flex items-center gap-0.5">
                        <Trophy className="w-2 h-2" />
                        Top 1
                      </span>
                    )}
                    <span className="font-mono font-bold text-[10px] sm:text-[11px] text-slate-800 dark:text-slate-200 block truncate max-w-full">
                      {item.grossRevenue > 0 ? formatCurrency(item.grossRevenue) : 'R$ 0'}
                    </span>
                    <span className="font-mono text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 block">
                      {formatPercent(item.percentage, 2)}
                    </span>
                  </div>

                  {/* Trilha e Barra Vertical Fina/Esbelta */}
                  <div className="w-5 sm:w-8 md:w-9 h-24 sm:h-32 bg-slate-200/60 dark:bg-slate-800/80 rounded-t-md p-0.5 flex items-end overflow-hidden transition-all group-hover:bg-slate-300/60 dark:group-hover:bg-slate-700/80">
                    <div
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        isBest
                          ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                          : item.grossRevenue > 0
                          ? 'bg-gradient-to-t from-indigo-600 to-blue-500 group-hover:from-indigo-500 group-hover:to-blue-400'
                          : 'bg-slate-300/40 dark:bg-slate-700/40'
                      }`}
                      style={{ height: `${Math.max(barPercent, 4)}%` }}
                    />
                  </div>

                  {/* Rótulo do Dia da Semana Abaixo */}
                  <div className="mt-2 pt-1 border-t border-slate-200/80 dark:border-slate-800 w-full">
                    <span className={`block text-xs sm:text-sm font-bold ${
                      isBest ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'
                    }`}>
                      {item.shortName}
                    </span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {item.salesCount} {item.salesCount === 1 ? 'venda' : 'vendas'}
                    </span>
                    <span className="hidden md:block text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                      {item.salesCount > 0 ? formatCurrency(item.avgTicket) : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* 2. VISÃO DE TABELA DETALHADA */
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-[#061224] text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-[#142C52]">
              <tr>
                <th className="py-2 px-3">Dia da Semana</th>
                <th className="py-2 px-3 text-center">Vendas</th>
                <th className="py-2 px-3 text-right">Faturamento Bruto</th>
                <th className="py-2 px-3 text-right">Líquido</th>
                <th className="py-2 px-3 text-right">Ticket Médio</th>
                <th className="py-2 px-3 text-right w-36">Participação</th>
                {orderedData.some((d) => d.spend > 0) && (
                  <>
                    <th className="py-2 px-3 text-right">Gasto Meta Ads</th>
                    <th className="py-2 px-3 text-right">ROAS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52] text-slate-700 dark:text-slate-300">
              {orderedData.map((item) => {
                const isBest = bestRevenueDay && bestRevenueDay.dayIndex === item.dayIndex && item.grossRevenue > 0
                return (
                  <tr
                    key={item.dayIndex}
                    className={`hover:bg-slate-50/70 dark:hover:bg-[#0d223f] transition-colors ${
                      isBest ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-50 dark:bg-indigo-950/60 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                          {item.shortName}
                        </span>
                        <span>{item.name}</span>
                        {isBest && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            🏆 Top 1
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px]">
                        {formatNumber(item.salesCount)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.grossRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatCurrency(item.netRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium">
                      {formatCurrency(item.avgTicket)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isBest ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono font-semibold text-[11px] min-w-[3.25rem] text-right">
                          {formatPercent(item.percentage, 2)}
                        </span>
                      </div>
                    </td>
                    {orderedData.some((d) => d.spend > 0) && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono text-orange-500">
                          {item.spend > 0 ? formatCurrency(item.spend) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {item.roas > 0 ? (
                            <span className={item.roas >= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600'}>
                              {item.roas.toFixed(2)}x
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
