'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Users, 
  UserPlus, 
  Search, 
  MoreVertical, 
  UserCheck, 
  UserX, 
  KeyRound, 
  Trash2, 
  X, 
  Check, 
  ShieldAlert,
  Loader2,
  Lock,
  Building2
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState<any>(null)
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null)

  // Form State Novo Cliente
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newWorkspace, setNewWorkspace] = useState('')
  const [newRole, setNewRole] = useState('CLIENT')
  const [createError, setCreateError] = useState('')

  // Form State Reset Password
  const [resetPasswordVal, setResetPasswordVal] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  // Query de Usuários
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, statusFilter, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (roleFilter !== 'ALL') params.set('role', roleFilter)

      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar usuários')
      return res.json()
    },
  })

  // Mutation Criar Usuário
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Erro ao criar usuário')
      return resData
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setShowCreateModal(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewWorkspace('')
      setCreateError('')
    },
    onError: (err: any) => {
      setCreateError(err.message)
    },
  })

  // Mutation Alterar Status
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Erro ao alterar status')
      return resData
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    },
  })

  // Mutation Redefinir Senha
  const resetMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Erro ao redefinir senha')
      return resData
    },
    onSuccess: () => {
      setResetMsg('Senha redefinida com sucesso!')
      setTimeout(() => {
        setShowResetModal(null)
        setResetMsg('')
        setResetPasswordVal('')
      }, 2000)
    },
  })

  // Mutation Excluir Usuário
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Erro ao excluir usuário')
      return resData
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      setShowDeleteModal(null)
    },
  })

  const users = data?.users || []

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    createMutation.mutate({
      name: newName,
      email: newEmail,
      password: newPassword,
      workspaceName: newWorkspace,
      role: newRole,
      status: 'ACTIVE',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestão de Usuários & Clientes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastre novos clientes, defina senhas temporárias, suspenda ou reative acessos à plataforma
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0066FF] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" /> + Novo Cliente
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="SUSPENDED">Suspensos</option>
            <option value="DISABLED">Desativados</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todos os Papéis</option>
            <option value="ADMIN">ADMIN</option>
            <option value="CLIENT">CLIENT</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#061326] border-b border-slate-200 dark:border-[#142C52] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Nome / E-mail</th>
                <th className="px-5 py-3.5">Papel</th>
                <th className="px-5 py-3.5">Workspace</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Último Acesso</th>
                <th className="px-5 py-3.5">Cadastrado em</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Nenhum usuário encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => {
                  const ws = u.memberships?.[0]?.workspace
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-[#0E2547]/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{u.name || 'Sem nome'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{ws?.name || 'Nenhum'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : u.status === 'SUSPENDED'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                        }`}>
                          {u.status === 'ACTIVE' ? 'Ativo' : u.status === 'SUSPENDED' ? 'Suspenso' : 'Desativado'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Nunca acessou'}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {formatDateTime(u.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Status (Ativar / Suspender) */}
                          {u.status === 'ACTIVE' ? (
                            <button
                              onClick={() => statusMutation.mutate({ id: u.id, status: 'SUSPENDED' })}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              title="Suspender acesso"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => statusMutation.mutate({ id: u.id, status: 'ACTIVE' })}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              title="Reativar acesso"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Redefinir Senha */}
                          <button
                            onClick={() => setShowResetModal(u)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            title="Redefinir senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Excluir Usuário */}
                          <button
                            onClick={() => setShowDeleteModal(u)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novo Cliente */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0066FF]" /> Cadastrar Novo Cliente
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-400 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Carlos Andrade"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="carlos@empresa.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Senha Inicial (mínimo 8 caracteres)</label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Defina a senha que o cliente usará"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Workspace (Opcional)</label>
                <input
                  type="text"
                  value={newWorkspace}
                  onChange={(e) => setNewWorkspace(e.target.value)}
                  placeholder="Ex: Operação Escala"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Papel (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CLIENT">CLIENT (Cliente Autorizado)</option>
                  <option value="ADMIN">ADMIN (Administrador)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0E2547] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Criando...' : 'Salvar e Liberar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redefinir Senha */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-500" /> Redefinir Senha
              </h2>
              <button onClick={() => setShowResetModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Redefina a senha de acesso para o usuário <strong className="text-slate-900 dark:text-white">{showResetModal.email}</strong>.
            </p>

            {resetMsg && (
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold">
                {resetMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
              <input
                type="text"
                minLength={8}
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061326] border border-slate-200 dark:border-[#142C52] rounded-xl text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetPasswordVal.length < 8 || resetMutation.isPending}
                onClick={() => resetMutation.mutate({ id: showResetModal.id, newPassword: resetPasswordVal })}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {resetMutation.isPending ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Confirmar Exclusão de Acesso</h2>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tem certeza que deseja revogar o acesso e excluir o usuário <strong className="text-slate-900 dark:text-white">{showDeleteModal.name} ({showDeleteModal.email})</strong>?
              Os dados de tracking e vendas do workspace serão preservados.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(showDeleteModal.id)}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Sim, Excluir Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
