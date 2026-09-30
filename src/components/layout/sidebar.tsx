'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  BarChart2, 
  BarChart3, 
  LayoutDashboard, 
  AppWindow,
  TrendingUp,
  Link2,
  ShoppingBag,
  Plug,
  GitBranch,
  Percent,
  Receipt,
  Activity,
  Bell,
  User,
  Settings,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import { UtmTrackLogo } from '@/components/brand/logo'


const navigation = [
  {
    title: 'PRINCIPAL',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Meta Ads', href: '/meta-ads', icon: TrendingUp },
      { name: 'Integrações', href: '/integrations', icon: Plug },
    ],
  },
  {
    title: 'APLICATIVO & AVANÇADO',
    items: [
      { name: 'Aplicativo', href: '/dashboard/app', icon: AppWindow },
      { name: 'Avançado', href: '/dashboard/advanced', icon: BarChart3 },
    ],
  },
  {
    title: 'OPERAÇÃO & ANÁLISE',
    items: [
      { name: 'Vendas', href: '/sales', icon: ShoppingBag },
      { name: 'UTM', href: '/utm', icon: Link2 },
      { name: 'Regras', href: '/rules', icon: GitBranch },
      { name: 'Taxas', href: '/fees', icon: Percent },
      { name: 'Despesas', href: '/expenses', icon: Receipt },
      { name: 'Relatórios', href: '/reports', icon: BarChart2 },
      { name: 'Eventos', href: '/events', icon: Activity },
      { name: 'Notificações', href: '/notifications', icon: Bell },
    ],
  },
  {
    title: 'CONFIGURAÇÕES',
    items: [
      { name: 'Minha conta', href: '/account', icon: User },
      { name: 'Configurações', href: '/settings', icon: Settings },
      { name: 'Alertas & Push', href: '/settings/notifications', icon: Bell },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  // Auto-close mobile sidebar whenever pathname changes
  const closeSidebar = () => setIsOpen(false)

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        type="button"
        className="md:hidden fixed top-3.5 left-3.5 z-50 p-2 bg-white dark:bg-[#060E1C] border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-200 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-[#0E2547] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-5 h-5 text-slate-700 dark:text-slate-200" /> : <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />}
      </button>

      {/* Sidebar Content */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-[#060E1C] border-r border-slate-200 dark:border-[#142C52] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } md:relative md:w-60 md:translate-x-0 overflow-y-auto flex flex-col`}
      >
        {/* Header with Logo + Mobile Close Button */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200 dark:border-[#142C52] shrink-0">
          <Link href="/dashboard" onClick={closeSidebar} className="transition-opacity hover:opacity-90">
            <UtmTrackLogo size="md" />
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0E2547] transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu (with bottom padding for mobile bottom bar) */}
        <nav className="flex-1 px-4 py-6 space-y-7 pb-28 md:pb-8 overflow-y-auto">
          {navigation.map((group) => (
            <div key={group.title}>
              <h3 className="px-2 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={closeSidebar}
                      className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg group transition-all duration-150 ${
                        isActive
                          ? 'bg-[#0066FF] text-white font-semibold shadow-md shadow-[#0066FF]/25'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0E2547] hover:text-[#0066FF] dark:hover:text-[#00D4FF]'
                      }`}
                    >
                      <item.icon
                        className={`mr-3 flex-shrink-0 h-5 w-5 ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-[#0066FF] dark:text-slate-400 dark:group-hover:text-[#00D4FF]'
                        }`}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Painel Administrativo (Exclusivo para ADMIN) */}
          {session?.user && ((session.user as any).role === 'ADMIN' || (session.user as any).role === 'SUPER_ADMIN') && (
            <div>
              <h3 className="px-2 text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> ADMINISTRAÇÃO
              </h3>
              <div className="space-y-1">
                <Link
                  href="/admin"
                  onClick={closeSidebar}
                  className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg group transition-all duration-150 ${
                    pathname.startsWith('/admin')
                      ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-600/25'
                      : 'text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/60'
                  }`}
                >
                  <ShieldCheck
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      pathname.startsWith('/admin') ? 'text-white' : 'text-purple-600 dark:text-purple-400'
                    }`}
                    aria-hidden="true"
                  />
                  Painel Admin
                </Link>
              </div>
            </div>
          )}
        </nav>
      </div>
      
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
    </>
  )
}
