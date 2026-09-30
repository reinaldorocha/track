'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { RefreshCw, TrendingUp, DollarSign, ShieldAlert, Sparkles, ArrowRight, Layers } from 'lucide-react'
import { PeriodSelector } from './period-selector'
import { MetricsGrid } from './metrics-grid'
import { RevenueChart } from './revenue-chart'
import { FunnelChart } from './funnel-chart'
import { getDateRange, formatCurrency, formatPercent, formatNumber } from '@/lib/utils'

export function DashboardContent() {
  const [period, setPeriod] = useState({
    preset: 'Últimos 30 dias',
    ...getDateRange('Últimos 30 dias')
  })

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      const res = await axios.get('/api/dashboard/metrics', {
        params: { from: period.from.toISOString(), to: period.to.toISOString() }
      })
      return res.data
    }
  })

  if (error) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#081A33] rounded-xl border border-rose-200 dark:border-rose-900 shadow-sm">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Erro ao carregar métricas</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ocorreu uma falha ao consultar o banco de dados. Tente novamente.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow hover:bg-blue-700"
        >
          Tentar Novamente
        </button>
      </div>
    )
  }

  const hasNoData = !isLoading && data && data.adSpend === 0 && data.sales === 0 && data.pageViews === 0

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Topo: Título + Seletor de Período com todos os filtros + Botão Atualizar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#081A33] dark:text-white tracking-tight">
            Dashboard Geral
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visão unificada de faturamento, gastos com anúncios, lucro e funil de conversão
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PeriodSelector 
            value={period.preset}
            onChange={(preset, from, to) => setPeriod({ preset, from, to, label: preset })}
          />

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] shadow-sm transition-colors disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : "text-slate-500"}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Banner amigável caso não haja dados ainda sem esconder a interface */}
      {hasNoData && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Comece a monitorar suas vendas e tráfego
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Conecte suas contas Meta Ads ou instale o script de rastreamento para visualizar suas métricas em tempo real.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/meta-ads"
              className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow"
            >
              Conectar Meta Ads
            </Link>
            <Link
              href="/integrations/tracker"
              className="px-3.5 py-1.5 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              Instalar Tracker
            </Link>
          </div>
        </div>
      )}

      {/* Grade Principal de 14 Indicadores Reais */}
      <MetricsGrid data={data} loading={isLoading} />
      
      {/* Gráficos Financeiros & Resumo da Operação */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart data={data?.chartData || []} loading={isLoading} />
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#081A33] p-6 rounded-xl border border-slate-200 dark:border-[#142C52] shadow-sm h-full flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#081A33] dark:text-white mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Resumo da Operação
              </h3>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#142C52] pb-2.5">
                  <span className="text-slate-500 dark:text-slate-400">Investimento em Anúncios</span>
                  <span className="font-bold font-mono text-[#081A33] dark:text-white">
                    {data ? formatCurrency(data.adSpend) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#142C52] pb-2.5">
                  <span className="text-slate-500 dark:text-slate-400">Custo por Aquisição (CPA)</span>
                  <span className="font-bold font-mono text-[#081A33] dark:text-white">
                    {data?.cpa ? formatCurrency(data.cpa) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#142C52] pb-2.5">
                  <span className="text-slate-500 dark:text-slate-400">Retorno sobre Gasto (ROAS)</span>
                  <span className="font-bold font-mono text-[#0066FF] dark:text-[#00D4FF]">
                    {data?.roas ? `${data.roas.toFixed(2)}x` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#142C52] pb-2.5">
                  <span className="text-slate-500 dark:text-slate-400">ROI Total</span>
                  <span className={`font-bold font-mono ${(data?.roi || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {data?.roi !== null && data?.roi !== undefined ? formatPercent(data.roi) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Lucro Líquido Real</span>
                  <span className={`font-bold font-mono text-sm ${(data?.profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {data ? formatCurrency(data.profit) : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-[#142C52] mt-4">
              <Link
                href="/summary"
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-50 dark:bg-[#061224] hover:bg-slate-100 dark:hover:bg-[#142C52] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Ver Relatório Consolidado <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Funil de Conversão e Vendas */}
      <FunnelChart 
        impressions={data?.impressions || 0}
        clicks={data?.clicks || 0}
        pageViews={data?.pageViews || 0}
        checkoutInitiations={data?.checkoutInitiations || 0}
        purchases={data?.sales || 0}
        approvedSales={data?.approvedSales || 0}
        spend={data?.adSpend || 0}
        loading={isLoading}
      />
    </div>
  )
}
