'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  ShieldAlert, 
  ArrowLeft,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import { UtmTrackLogo } from '@/components/brand/logo'

const adminNav = [
  { name: 'Visão Geral', href: '/admin', icon: LayoutDashboard },
  { name: 'Usuários & Clientes', href: '/admin/users', icon: Users },
  { name: 'Workspaces', href: '/admin/workspaces', icon: Building2 },
  { name: 'Logs de Auditoria', href: '/admin/audit', icon: ShieldAlert },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const closeSidebar = () => setIsOpen(false)

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        type="button"
        className="md:hidden fixed top-3.5 left-3.5 z-50 p-2 bg-white dark:bg-[#060E1C] border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-200 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-[#0E2547] transition-colors focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu administrativo"
      >
        {isOpen ? <X className="w-5 h-5 text-slate-700 dark:text-slate-200" /> : <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />}
      </button>

      {/* Admin Sidebar Container */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-[#060E1C] border-r border-slate-200 dark:border-[#142C52] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } md:relative md:w-64 md:translate-x-0 overflow-y-auto flex flex-col`}
      >
        {/* Header with Logo + Admin Badge */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-200 dark:border-[#142C52] shrink-0">
          <div className="flex items-center gap-2.5">
            <Link href="/admin" onClick={closeSidebar} className="transition-opacity hover:opacity-90">
              <UtmTrackLogo size="sm" />
            </Link>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Admin
            </span>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          <div>
            <h3 className="px-2 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">
              Painel do Proprietário
            </h3>
            <div className="space-y-1">
              {adminNav.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={closeSidebar}
                    className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg group transition-all duration-150 ${
                      isActive
                        ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-600/25'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0E2547] hover:text-purple-600 dark:hover:text-purple-400'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 group-hover:text-purple-600 dark:text-slate-400 dark:group-hover:text-purple-400'
                      }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Footer: Voltar ao Painel Principal */}
        <div className="p-4 border-t border-slate-200 dark:border-[#142C52]">
          <Link
            href="/dashboard"
            onClick={closeSidebar}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#0E2547] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Dashboard
          </Link>
        </div>
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
