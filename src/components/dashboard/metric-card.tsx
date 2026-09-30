'use client'

import { Info, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type MetricCardProps = {
  title: string
  value: string
  subtitle?: string
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  loading?: boolean
  tooltip?: string
  className?: string
}

export function MetricCard({
  title, value, subtitle, change, changeLabel, icon, loading, tooltip, className
}: MetricCardProps) {
  return (
    <div className={cn("bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl shadow-sm hover:shadow-md transition-all p-5", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group relative cursor-default">
          {title}
          {tooltip && (
            <div className="relative flex items-center">
              <Info className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0066FF] dark:group-hover:text-[#00D4FF] transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-52 rounded-lg bg-[#081A33] dark:bg-[#0E2547] border border-[#142C52] p-2 text-xs font-normal text-white shadow-xl opacity-0 transition-opacity group-hover:block group-hover:opacity-100 z-30">
                {tooltip}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#081A33] dark:border-t-[#0E2547]" />
              </div>
            </div>
          )}
        </div>
        {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
      </div>
      
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-slate-200 dark:bg-[#0E2547] rounded w-1/2"></div>
          <div className="h-4 bg-slate-200 dark:bg-[#0E2547] rounded w-1/3"></div>
        </div>
      ) : (
        <div>
          <div className="text-2xl font-black text-[#081A33] dark:text-white tracking-tight">
            {value}
          </div>
          {(change !== undefined || subtitle) && (
            <div className="flex items-center gap-2 mt-1 text-xs">
              {change !== undefined && change !== null && (
                <div className={cn(
                  "flex items-center font-semibold",
                  change > 0 ? "text-emerald-600 dark:text-emerald-400" : change < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"
                )}>
                  {change > 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : change < 0 ? <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> : null}
                  {Math.abs(change)}%
                </div>
              )}
              {changeLabel && <span className="text-slate-500 dark:text-slate-400">{changeLabel}</span>}
              {subtitle && <span className="text-slate-500 dark:text-slate-400">{subtitle}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
