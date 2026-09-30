'use client'

import React, { useState } from 'react'
import { Package, Search } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

export interface ProductSaleItem {
  id: string
  name: string
  salesCount: number
  grossRevenue: number
  netRevenue: number
  avgTicket: number
  percentage: number
}

interface ProductSalesCardProps {
  products?: ProductSaleItem[]
  loading?: boolean
}

export function ProductSalesCard({ products = [], loading = false }: ProductSalesCardProps) {
  const [search, setSearch] = useState('')

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Vendas &amp; Faturamento por Produto
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {products.length} {products.length === 1 ? 'Produto' : 'Produtos'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ranking de receita bruta, volume de pedidos e ticket médio por produto
            </p>
          </div>
        </div>

        {/* Busca rápida */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Carregando produtos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#142C52] rounded-xl">
          <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum produto encontrado</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {search ? 'Tente buscar com outro termo' : 'As vendas aprovadas aparecerão aqui'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-[#061224] text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-[#142C52]">
              <tr>
                <th className="py-2.5 px-3">Produto</th>
                <th className="py-2.5 px-3 text-center">Vendas</th>
                <th className="py-2.5 px-3 text-right">Faturamento Bruto</th>
                <th className="py-2.5 px-3 text-right">Líquido</th>
                <th className="py-2.5 px-3 text-right">Ticket Médio</th>
                <th className="py-2.5 px-3 text-right w-36">Participação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52] text-slate-700 dark:text-slate-300">
              {filtered.map((prod, idx) => (
                <tr
                  key={prod.id || idx}
                  className="hover:bg-slate-50/70 dark:hover:bg-[#0d223f] transition-colors"
                >
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white max-w-[280px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <span className="truncate" title={prod.name}>
                        {prod.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px]">
                      {formatNumber(prod.salesCount)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(prod.grossRevenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrency(prod.netRevenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium">
                    {formatCurrency(prod.avgTicket)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(Number(prod.percentage) || 0, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono font-semibold text-[11px] min-w-[3.5rem] text-right">
                        {formatPercent(Number(prod.percentage) || 0, 2)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
