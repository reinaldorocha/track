'use client'

import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from '@/components/theme-provider'
import { useQuery } from '@tanstack/react-query'
import { Moon, Sun, Bell, LogOut, ChevronDown, Trophy, Globe, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { UtmTrackLogo } from '@/components/brand/logo'
import { formatCurrency } from '@/lib/utils'

export function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Buscar faturamento acumulado total para a barra de progresso / meta
  const { data: summaryData } = useQuery({
    queryKey: ['header-revenue-progress'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/metrics')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 60000,
  })

  const accumulatedRevenue = summaryData?.grossRevenue || 0
  const targetGoal = 1000000 // Meta de R$ 1 Milhão
  const progressPercent = Math.min(Math.round((accumulatedRevenue / targetGoal) * 100 * 10) / 10, 100)

  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return 'Dashboard'
    const last = segments[segments.length - 1]
    if (last === 'dashboard') return 'Dashboard Geral'
    if (last === 'meta-ads') return 'Meta Ads'
    if (last === 'summary') return 'Resumo'
    if (last === 'integrations') return 'Integrações'
    if (last === 'utm') return 'UTMs & Tracking'
    if (last === 'sales') return 'Vendas'
    return last.charAt(0).toUpperCase() + last.slice(1).replace('-', ' ')
  }

  return (
    <header className="h-16 px-4 md:px-6 bg-white dark:bg-[#060E1C] border-b border-slate-200 dark:border-[#142C52] flex items-center justify-between shrink-0 gap-4">
      {/* Esquerda: Logo Mobile + Título */}
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center pl-10">
          <UtmTrackLogo size="sm" />
        </div>
        <h1 className="text-base md:text-lg font-bold text-[#081A33] dark:text-white hidden md:block truncate">
          {getPageTitle()}
        </h1>
      </div>

      {/* Centro: Barra de Progresso / Meta de Premiação */}
      <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-slate-50 dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-full shadow-inner">
        <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
          <Trophy className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-700 dark:text-slate-200">
            <span>{formatCurrency(accumulatedRevenue)}</span>
            <span className="text-slate-400 font-normal">/ {formatCurrency(targetGoal)}</span>
          </div>
          <div className="w-36 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-0.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-cyan-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 1)}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] font-bold font-mono text-blue-600 dark:text-cyan-400">
          {progressPercent}%
        </span>
      </div>

      {/* Direita: Idioma, Tema, Notificações, Perfil */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        {/* Indicador de Idioma */}
        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="text-sm">🇧🇷</span>
          <span>PT-BR</span>
        </div>

        {/* Alternar Tema */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#0E2547] transition-colors"
          title="Alternar tema"
          aria-label="Alternar tema claro/escuro"
        >
          {mounted && theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
        </button>

        {/* Notificações */}
        <a 
          href="/notifications" 
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#0E2547] transition-colors relative"
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell className="w-4 h-4" />
        </a>

        {/* Menu do Usuário */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0E2547] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#0066FF] to-[#00D4FF] flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left text-xs">
              <p className="font-semibold text-slate-900 dark:text-white line-clamp-1">{session?.user?.name || 'Usuário'}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#081A33] rounded-xl shadow-xl py-1 ring-1 ring-black/5 border border-slate-200 dark:border-[#142C52] z-50 animate-in fade-in">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-[#142C52] md:hidden">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{session?.user?.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{session?.user?.email}</p>
              </div>
              <a
                href="/account"
                className="flex items-center px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0E2547]"
              >
                Minha Conta
              </a>
              {((session?.user as any)?.role === 'ADMIN' || (session?.user as any)?.role === 'SUPER_ADMIN') && (
                <a
                  href="/admin"
                  className="flex items-center px-4 py-2 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                  Painel Admin
                </a>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
