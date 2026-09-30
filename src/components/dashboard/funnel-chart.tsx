'use client'

import React from 'react'
import { Info } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

type FunnelChartProps = {
  impressions?: number
  clicks?: number
  pageViews?: number
  checkoutInitiations?: number
  purchases?: number
  approvedSales?: number
  spend?: number
  loading?: boolean
}

function formatFunnelPct(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return '0%'
  if (val >= 100) return '100%'
  if (val < 0.1) return `${val.toFixed(2)}%`
  return `${val.toFixed(1)}%`
}

function generateFunnelPath(h: number[]): string {
  const cY = 80
  const topY = h.map((val) => Number((cY - val).toFixed(1)))
  const botY = h.map((val) => Number((cY + val).toFixed(1)))

  let d = `M 0,${topY[0]} L 150,${topY[0]}`
  d += ` C 200,${topY[0]} 200,${topY[1]} 250,${topY[1]}`
  d += ` L 350,${topY[1]}`
  d += ` C 400,${topY[1]} 400,${topY[2]} 450,${topY[2]}`
  d += ` L 550,${topY[2]}`
  d += ` C 600,${topY[2]} 600,${topY[3]} 650,${topY[3]}`
  d += ` L 750,${topY[3]}`
  d += ` C 800,${topY[3]} 800,${topY[4]} 850,${topY[4]}`
  d += ` L 1000,${topY[4]}`

  // Borda vertical direita
  d += ` L 1000,${botY[4]}`

  // Borda inferior
  d += ` L 850,${botY[4]}`
  d += ` C 800,${botY[4]} 800,${botY[3]} 750,${botY[3]}`
  d += ` L 650,${botY[3]}`
  d += ` C 600,${botY[3]} 600,${botY[2]} 550,${botY[2]}`
  d += ` L 450,${botY[2]}`
  d += ` C 400,${botY[2]} 400,${botY[1]} 350,${botY[1]}`
  d += ` L 250,${botY[1]}`
  d += ` C 200,${botY[1]} 200,${botY[0]} 150,${botY[0]}`
  d += ` L 0,${botY[0]}`

  d += ` Z`

  return d
}

export function FunnelChart({
  clicks = 0,
  pageViews = 0,
  checkoutInitiations = 0,
  purchases = 0,
  approvedSales = 0,
  loading = false
}: FunnelChartProps) {
  if (loading) {
    return (
      <div className="w-full h-64 bg-slate-50 dark:bg-[#081A33] animate-pulse rounded-xl border border-slate-200 dark:border-[#142C52]" />
    )
  }

  const countClicks = Number(clicks || 0)
  const countPageViews = Number(pageViews || 0)
  const countICs = Number(checkoutInitiations || 0)
  const countVendasInic = Number(purchases || 0)
  const countVendasApr = Number(approvedSales || 0)

  // Percentuais sempre de acordo com os Cliques
  const pctClicks = countClicks > 0 ? 100 : 0
  const pctPageViews = countClicks > 0 ? (countPageViews / countClicks) * 100 : 0
  const pctICs = countClicks > 0 ? (countICs / countClicks) * 100 : 0
  const pctVendasInic = countClicks > 0 ? (countVendasInic / countClicks) * 100 : 0
  const pctVendasApr = countClicks > 0 ? (countVendasApr / countClicks) * 100 : 0

  const rawPcts = [pctClicks, pctPageViews, pctICs, pctVendasInic, pctVendasApr]

  const h_max = 68
  const h_min = 18
  const heights: number[] = []
  let prevH = h_max

  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      const baseH = countClicks > 0 ? h_max : h_min
      heights.push(baseH)
      prevH = baseH
    } else {
      const clampedPct = Math.max(0, Math.min(100, rawPcts[i]))
      const rawH = h_min + (clampedPct / 100) * (h_max - h_min)
      const stepH = Math.min(prevH, rawH)
      heights.push(stepH)
      prevH = stepH
    }
  }

  const funnelPath = generateFunnelPath(heights)

  const steps = [
    {
      id: 'clicks',
      title: 'Cliques',
      count: countClicks,
      pctDisplay: `${pctClicks}%`,
      centerX: 100,
    },
    {
      id: 'pageViews',
      title: 'Vis. Página',
      count: countPageViews,
      pctDisplay: formatFunnelPct(pctPageViews),
      centerX: 300,
    },
    {
      id: 'ics',
      title: 'ICs',
      count: countICs,
      pctDisplay: formatFunnelPct(pctICs),
      centerX: 500,
    },
    {
      id: 'vendasInic',
      title: 'Vendas Inic.',
      count: countVendasInic,
      pctDisplay: formatFunnelPct(pctVendasInic),
      centerX: 700,
    },
    {
      id: 'vendasApr',
      title: 'Vendas Apr.',
      count: countVendasApr,
      pctDisplay: formatFunnelPct(pctVendasApr),
      centerX: 900,
    },
  ]

  return (
    <div className="bg-white dark:bg-[#081A33] rounded-2xl border border-slate-200/90 dark:border-[#142C52] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Funil de Conversão (Meta Ads)
        </h3>
        <div
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title="Funil contínuo do tráfego: todos os percentuais calculados em relação ao total de cliques (padrão UTMfy)"
        >
          <Info className="w-4 h-4 cursor-pointer" />
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="relative grid grid-cols-5 divide-x divide-slate-200/80 dark:divide-slate-800/80">
            {steps.map((step) => (
              <div
                key={step.id}
                className="relative z-10 flex flex-col justify-between py-2 text-center pointer-events-none"
              >
                <div className="pb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {step.title}
                </div>

                <div className="h-32 sm:h-36" />

                <div className="pt-3 font-mono font-bold text-base text-slate-900 dark:text-white">
                  {formatNumber(step.count)}
                </div>
              </div>
            ))}

            <div className="absolute inset-x-0 top-9 bottom-9 flex items-center justify-center pointer-events-none z-20">
              <svg
                viewBox="0 0 1000 160"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <defs>
                  <linearGradient
                    id="utmfyFunnelGradientOld"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#0062FF" />
                    <stop offset="25%" stopColor="#2563EB" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="75%" stopColor="#9333EA" />
                    <stop offset="100%" stopColor="#D92686" />
                  </linearGradient>
                </defs>

                <line
                  x1="200"
                  y1="0"
                  x2="200"
                  y2="160"
                  stroke="currentColor"
                  className="text-slate-200/70 dark:text-slate-800/70"
                  strokeWidth="1"
                />
                <line
                  x1="400"
                  y1="0"
                  x2="400"
                  y2="160"
                  stroke="currentColor"
                  className="text-slate-200/70 dark:text-slate-800/70"
                  strokeWidth="1"
                />
                <line
                  x1="600"
                  y1="0"
                  x2="600"
                  y2="160"
                  stroke="currentColor"
                  className="text-slate-200/70 dark:text-slate-800/70"
                  strokeWidth="1"
                />
                <line
                  x1="800"
                  y1="0"
                  x2="800"
                  y2="160"
                  stroke="currentColor"
                  className="text-slate-200/70 dark:text-slate-800/70"
                  strokeWidth="1"
                />

                <path d={funnelPath} fill="url(#utmfyFunnelGradientOld)" />

                {steps.map((step) => (
                  <text
                    key={step.id}
                    x={step.centerX}
                    y="80"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#FFFFFF"
                    fontSize="24"
                    fontWeight="800"
                    fontFamily="sans-serif"
                    className="select-none drop-shadow-sm"
                  >
                    {step.pctDisplay}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
