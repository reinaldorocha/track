'use client'

import React from 'react'
import { Link2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export interface SrcDistributionItem {
  name: string
  src: string
  count: number
  revenue: number
  percentage: number
}

interface SrcDistributionCardProps {
  data?: SrcDistributionItem[]
  loading?: boolean
}

export function SrcDistributionCard({ data = [], loading = false }: SrcDistributionCardProps) {
  const totalRevenue = data.reduce((acc, item) => acc + item.revenue, 0)

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Vendas por SRC (Sub-origem)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                {data.length} tags
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição de pedidos e receita pelo parâmetro de rastreamento <code className="font-mono text-indigo-500">src</code>
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Rastreado</span>
          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalRevenue)}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
          Carregando dados por src...
        </div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#142C52] rounded-xl">
          <Link2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum parâmetro src identificado</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ao incluir <code className="font-mono text-indigo-500">?src=nome_da_origem</code> nos seus links, as vendas serão agrupadas aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {data.slice(0, 8).map((item, idx) => (
            <div
              key={item.src || idx}
              className="p-3 bg-slate-50 dark:bg-[#061224] rounded-xl border border-slate-100 dark:border-[#142C52] space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {item.src || 'direto / sem_src'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">
                    {item.count} {item.count === 1 ? 'venda' : 'vendas'}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
