'use client'

import React, { useMemo } from 'react'
import { CreditCard, QrCode, FileText, HelpCircle } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

export interface PaymentItem {
  name: string
  key?: string
  count: number
  approved: number
  gross: number
  rate: number
}

interface PaymentMethodsCardProps {
  data?: PaymentItem[]
  loading?: boolean
}

export function PaymentMethodsCard({ data = [], loading = false }: PaymentMethodsCardProps) {
  // Filtrar para mostrar Pix, Cartão e Boleto (e Outros apenas se houver movimentação)
  const methods = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.filter((item) => {
      const lower = item.name.toLowerCase()
      if (lower === 'outros' && item.count === 0 && item.gross === 0) return false
      return true
    })
  }, [data])

  const getIcon = (name: string) => {
    const lower = name.toLowerCase()
    if (lower.includes('pix')) {
      return <QrCode className="w-4 h-4 text-emerald-500" />
    }
    if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('card')) {
      return <CreditCard className="w-4 h-4 text-blue-500" />
    }
    if (lower.includes('boleto')) {
      return <FileText className="w-4 h-4 text-amber-500" />
    }
    return <HelpCircle className="w-4 h-4 text-slate-400" />
  }

  const getBarColor = (name: string, rate: number) => {
    const lower = name.toLowerCase()
    if (lower.includes('pix')) return 'bg-emerald-500'
    if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('card')) return 'bg-blue-500'
    if (lower.includes('boleto')) return 'bg-amber-500'
    return rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
  }

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Vendas por Método de Pagamento &amp; Taxa de Aprovação
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Conversão real entre Pix, Cartão de Crédito e Boleto
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-[#142C52] rounded-xl">
          Nenhum pagamento registrado no período
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${
          methods.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
        } gap-3.5`}>
          {methods.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="p-4 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50/70 dark:bg-[#061224] flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                  {getIcon(item.name)}
                  <span>{item.name}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-[#0E2547] border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  {formatPercent(item.rate, 1)} aprov.
                </span>
              </div>

              <div>
                <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                  {formatCurrency(item.gross)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatNumber(item.approved)}/{formatNumber(item.count)} pedidos
                </p>
              </div>

              {/* Barra simples de aprovação */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${getBarColor(item.name, item.rate)}`}
                  style={{ width: `${Math.min(item.rate, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
