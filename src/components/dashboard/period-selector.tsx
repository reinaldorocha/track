'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check, X } from 'lucide-react'
import { getDateRange } from '@/lib/utils'
import { cn } from '@/lib/utils'

type PeriodSelectorProps = {
  value: string
  onChange: (preset: string, from: Date, to: Date) => void
}

const PRESETS = [
  'Hoje',
  'Ontem',
  'Últimos 7 dias',
  'Últimos 15 dias',
  'Últimos 30 dias',
  'Últimos 60 dias',
  'Últimos 90 dias',
  'Este mês',
  'Mês anterior',
  'Personalizado'
]

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (preset: string) => {
    if (preset !== 'Personalizado') {
      setIsCustomMode(false)
      const { from, to } = getDateRange(preset)
      onChange(preset, from, to)
      setOpen(false)
    } else {
      setIsCustomMode(true)
    }
  }

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      const from = new Date(`${customFrom}T00:00:00`)
      const to = new Date(`${customTo}T23:59:59.999`)
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        onChange(`Personalizado: ${customFrom} - ${customTo}`, from, to)
        setOpen(false)
      }
    }
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button 
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#0E2547] shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-full"
        aria-label="Selecionar período"
        aria-expanded={open}
      >
        <Calendar className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#00D4FF] shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[180px]">{value}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 ml-0.5 text-slate-400 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      
      {open && (
        <>
          {/* Overlay Mobile para fechar ao tocar fora e prevenir overflow */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 sm:hidden animate-in fade-in"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Container do Menu: Bottom Sheet no Mobile, Dropdown Flutuante no Desktop */}
          <div className="fixed sm:absolute bottom-0 sm:bottom-auto sm:top-full left-0 right-0 sm:left-auto sm:right-0 sm:mt-1.5 w-full sm:w-64 max-w-md sm:max-w-none mx-auto sm:mx-0 bg-white dark:bg-[#081A33] border-t sm:border border-slate-200 dark:border-[#142C52] rounded-t-2xl sm:rounded-xl shadow-2xl z-50 py-3 sm:py-2 overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-200">
            {/* Header Mobile com título e botão de fechar */}
            <div className="flex items-center justify-between px-4 pb-2 mb-1 border-b border-slate-100 dark:border-[#142C52]/60 sm:hidden">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> Selecionar Período
              </span>
              <button 
                type="button"
                onClick={() => setOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] sm:max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-[#142C52]/60 px-1 sm:px-0">
              <div className="py-1">
                {PRESETS.map((preset) => {
                  const isSelected = value.startsWith(preset)
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelect(preset)}
                      className={cn(
                        "flex items-center justify-between w-full text-left px-4 py-2.5 sm:py-2 text-xs rounded-lg sm:rounded-none transition-colors",
                        isSelected 
                          ? "bg-blue-50 dark:bg-[#0E2547] font-bold text-[#0066FF] dark:text-[#00D4FF]" 
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#0E2547]/60"
                      )}
                    >
                      <span>{preset}</span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-cyan-400" />}
                    </button>
                  )
                })}
              </div>

              {isCustomMode && (
                <div className="p-3.5 sm:p-3 bg-slate-50 dark:bg-[#061224] space-y-2.5 rounded-lg sm:rounded-none m-2 sm:m-0">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Selecionar Intervalo:</p>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Data Inicial:</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Data Final:</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    disabled={!customFrom || !customTo}
                    className="w-full py-2 bg-[#0066FF] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors"
                  >
                    Aplicar Período
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

