'use client'

import React from 'react'
import { Calendar } from 'lucide-react'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { formatCurrency } from '@/lib/utils'

interface DailySalesCardProps {
  data?: Array<{ date: string; revenue: number; spend: number; profit: number; sales?: number }>
  loading?: boolean
}

export function DailySalesCard({ data = [], loading = false }: DailySalesCardProps) {
  const totalRevenue = data.reduce((acc, d) => acc + (d.revenue || 0), 0)
  const totalSpend = data.reduce((acc, d) => acc + (d.spend || 0), 0)
  const totalProfit = totalRevenue - totalSpend

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Vendas / Dia (Evolução Diária)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {data.length} dias
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Curva diária de faturamento bruto vs investimento em anúncios vs lucro
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Receita</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalRevenue)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Gasto</span>
            <span className="font-bold text-orange-500">{formatCurrency(totalSpend)}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Lucro</span>
            <span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(totalProfit)}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full">
        <RevenueChart data={data} loading={loading} />
      </div>
    </div>
  )
}
