'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search, Users, Activity, ShoppingCart, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function AdminWorkspacesPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-workspaces', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/workspaces?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar workspaces')
      return res.json()
    },
  })

  const workspaces = data?.workspaces || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Workspaces & Tenants
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Visão consolidada de todos os ambientes de clientes isolados no UTM-Track
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Workspaces Table */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#061326] border-b border-slate-200 dark:border-[#142C52] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Nome / Slug</th>
                <th className="px-5 py-3.5">Membros</th>
                <th className="px-5 py-3.5">Contas de Anúncio</th>
                <th className="px-5 py-3.5">Integrações</th>
                <th className="px-5 py-3.5">Vendas Registradas</th>
                <th className="px-5 py-3.5">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Carregando workspaces...
                  </td>
                </tr>
              ) : workspaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    Nenhum workspace encontrado.
                  </td>
                </tr>
              ) : (
                workspaces.map((ws: any) => (
                  <tr key={ws.id} className="hover:bg-slate-50/60 dark:hover:bg-[#0E2547]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-500" />
                        <span>{ws.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{ws.slug}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold">{ws.membersCount}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">
                        {ws.members.map((m: any) => m.user?.email).filter(Boolean).join(', ')}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {ws.counts?.adAccounts || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {ws.counts?.integrations || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {ws.counts?.sales || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {formatDateTime(ws.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
