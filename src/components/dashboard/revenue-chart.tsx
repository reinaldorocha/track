'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils'

type ChartData = {
  date: string
  revenue: number
  spend: number
  profit: number
}

type RevenueChartProps = {
  data: ChartData[]
  loading?: boolean
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) {
    return (
      <div className="w-full h-[320px] bg-gray-50 dark:bg-gray-900 animate-pulse rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center">
        <span className="text-gray-400">Carregando gráfico...</span>
      </div>
    )
  }

  return (
    <div className="w-full h-[320px] bg-white dark:bg-[#081A33] p-4 rounded-xl border border-slate-200 dark:border-[#142C52] shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0066FF" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#142C52" opacity={0.3} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
            width={60}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#081A33', borderColor: '#142C52', color: '#fff', borderRadius: '10px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
            itemStyle={{ fontSize: '13px' }}
            formatter={(value: any) => formatCurrency(Number(value) || 0)}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
          />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }} />
          <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="#0066FF" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
          <Area type="monotone" dataKey="spend" name="Investimento" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" />
          <Area type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
