'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Activity, Filter, Loader2, User, Building2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', actionFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (actionFilter !== 'ALL') params.set('action', actionFilter)
      params.set('page', String(page))
      params.set('limit', '30')

      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar logs de auditoria')
      return res.json()
    },
  })

  const logs = data?.logs || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_USER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">Criação de Usuário</span>
      case 'SUSPEND_USER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">Suspensão de Acesso</span>
      case 'ACTIVATE_USER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">Reativação de Acesso</span>
      case 'DELETE_USER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">Exclusão de Usuário</span>
      case 'ROLE_CHANGE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">Alteração de Papel</span>
      case 'RESET_PASSWORD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">Redefinição de Senha</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#0E2547] text-slate-700 dark:text-slate-300">{action}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Logs de Auditoria & Segurança
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Registro cronológico e imutável de todas as ações administrativas realizadas no sistema
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todas as Ações</option>
            <option value="CREATE_USER">Criação de Usuário</option>
            <option value="SUSPEND_USER">Suspensão de Acesso</option>
            <option value="ACTIVATE_USER">Reativação de Acesso</option>
            <option value="DELETE_USER">Exclusão de Usuário</option>
            <option value="RESET_PASSWORD">Redefinição de Senha</option>
            <option value="ROLE_CHANGE">Alteração de Papel</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Total de registros: <strong className="text-slate-900 dark:text-white">{total}</strong>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#061326] border-b border-slate-200 dark:border-[#142C52] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Data / Hora</th>
                <th className="px-5 py-3.5">Ação Realizada</th>
                <th className="px-5 py-3.5">Administrador Responsável</th>
                <th className="px-5 py-3.5">Recurso / Alvo</th>
                <th className="px-5 py-3.5">IP</th>
                <th className="px-5 py-3.5">Detalhes / Metadados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Carregando eventos de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    Nenhum log registrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => {
                  let metaObj: any = null
                  try {
                    metaObj = log.metadata ? JSON.parse(log.metadata) : null
                  } catch (e) {
                    metaObj = null
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-[#0E2547]/40 transition-colors font-mono">
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200">
                        {log.userEmail || 'Sistema Automático'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {log.resource} {log.resourceId ? `(${log.resourceId.slice(0, 10)}...)` : ''}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                        {metaObj ? (
                          metaObj.targetEmail ? `Alvo: ${metaObj.targetEmail}` :
                          metaObj.createdUserEmail ? `Criado: ${metaObj.createdUserEmail}` :
                          JSON.stringify(metaObj)
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-[#142C52] flex items-center justify-between">
            <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#142C52] text-xs font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#142C52] text-xs font-bold disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
