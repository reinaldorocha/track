'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { 
  Users, 
  Building2, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  Plus, 
  ArrowRight,
  Sparkles,
  Activity
} from 'lucide-react'
import { UtmTrackSymbol } from '@/components/brand/symbol'
import { formatDateTime } from '@/lib/utils'

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Erro ao carregar estatísticas do admin')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const stats = data?.stats || {
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    totalWorkspaces: 0,
  }

  const recentUsers = data?.recentUsers || []
  const recentLogs = data?.recentAuditLogs || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <UtmTrackSymbol size={28} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Painel do Administrador
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Controle Total
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão global de clientes autorizados, isolamento de workspaces e auditoria de segurança
          </p>
        </div>

        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0066FF] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total de Usuários</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-[#0E2547] text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {isLoading ? '...' : stats.totalUsers}
          </div>
          <div className="text-[11px] text-slate-500">Contas cadastradas no sistema</div>
        </div>

        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Clientes Ativos</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {isLoading ? '...' : stats.activeUsers}
          </div>
          <div className="text-[11px] text-slate-500">Com acesso liberado ao sistema</div>
        </div>

        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Usuários Suspensos</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {isLoading ? '...' : stats.suspendedUsers}
          </div>
          <div className="text-[11px] text-slate-500">Acesso bloqueado pelo admin</div>
        </div>

        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Workspaces Isolados</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {isLoading ? '...' : stats.totalWorkspaces}
          </div>
          <div className="text-[11px] text-slate-500">Tenants independentes</div>
        </div>
      </div>

      {/* Two Column Layout: Recent Users & Security Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0066FF]" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Últimos Usuários</h2>
            </div>
            <Link href="/admin/users" className="text-xs font-bold text-[#0066FF] hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
            {recentUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Nenhum usuário cadastrado.</div>
            ) : (
              recentUsers.map((u: any) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{u.name || 'Sem nome'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-[#0E2547] text-slate-700 dark:text-slate-300'
                    }`}>
                      {u.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    }`}>
                      {u.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit Logs */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Atividade & Auditoria</h2>
            </div>
            <Link href="/admin/audit" className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1">
              Ver logs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
            {recentLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">Nenhum evento registrado ainda.</div>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{log.action}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {log.userEmail || 'Sistema'} • {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-[#0E2547] text-slate-600 dark:text-slate-300">
                    {log.resource}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
