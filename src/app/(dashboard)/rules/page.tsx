"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";

type RuleItem = {
  id: string;
  name: string;
  description?: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  priority: number;
  isActive: boolean;
};

export default function RulesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    conditionField: "utm_campaign",
    conditionOperator: "contains",
    conditionValue: "",
    actionType: "apply_fee",
    actionValue: "",
    priority: "0",
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ rules: RuleItem[] }>({
    queryKey: ["business-rules"],
    queryFn: async () => {
      const res = await fetch("/api/rules");
      if (!res.ok) throw new Error("Erro ao carregar regras");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao criar regra");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-rules"] });
      setIsModalOpen(false);
      setForm({
        name: "",
        description: "",
        conditionField: "utm_campaign",
        conditionOperator: "contains",
        conditionValue: "",
        actionType: "apply_fee",
        actionValue: "",
        priority: "0",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-rules"] }),
  });

  const rules = data?.rules || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Motor de Regras de Negócio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Automatize atribuições, custos operacionais e regras de conciliação com condições customizáveis
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow"
        >
          <Plus className="w-4 h-4" /> Nova Regra
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 text-xs">
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Nome da Regra</th>
              <th className="py-3 px-4">Condição (SE)</th>
              <th className="py-3 px-4">Ação Executada (ENTÃO)</th>
              <th className="py-3 px-4 text-center">Prioridade</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td colSpan={6} className="py-4 px-4">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">
                  <GitBranch className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="font-medium">Nenhuma regra de automação cadastrada</p>
                  <p className="text-xs mt-1">Crie regras condicionais para padronizar custos, taxas ou atribuições.</p>
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className="flex items-center gap-1.5 text-xs font-medium"
                      title="Clique para alternar status"
                    >
                      {rule.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-4 h-4" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <XCircle className="w-4 h-4" /> Inativa
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{rule.name}</p>
                    {rule.description && (
                      <p className="text-xs text-gray-500">{rule.description}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-gray-700 dark:text-gray-300">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">SE </span>
                    {rule.conditionField} {rule.conditionOperator} &quot;{rule.conditionValue}&quot;
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-gray-700 dark:text-gray-300">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">ENTÃO </span>
                    {rule.actionType}: {rule.actionValue}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-gray-500">
                    {rule.priority}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Excluir esta regra?")) deleteMutation.mutate(rule.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Excluir regra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Criar Nova Regra de Negócio</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Regra</label>
                <input
                  type="text"
                  placeholder="Ex: Taxa especial checkout Yampi"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg space-y-2">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Condição (SE):</span>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={form.conditionField}
                    onChange={(e) => setForm({ ...form, conditionField: e.target.value })}
                    className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                  >
                    <option value="utm_campaign">UTM Campaign</option>
                    <option value="campaign_name">Nome Campanha</option>
                    <option value="platform">Plataforma</option>
                    <option value="status">Status da Venda</option>
                  </select>

                  <select
                    value={form.conditionOperator}
                    onChange={(e) => setForm({ ...form, conditionOperator: e.target.value })}
                    className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                  >
                    <option value="contains">Contém</option>
                    <option value="equals">Igual a</option>
                    <option value="starts_with">Começa com</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Valor"
                    value={form.conditionValue}
                    onChange={(e) => setForm({ ...form, conditionValue: e.target.value })}
                    className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg space-y-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Ação (ENTÃO):</span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.actionType}
                    onChange={(e) => setForm({ ...form, actionType: e.target.value })}
                    className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                  >
                    <option value="apply_fee">Aplicar Taxa (%)</option>
                    <option value="apply_fixed_cost">Aplicar Custo Fixo (R$)</option>
                    <option value="set_status">Forçar Status</option>
                    <option value="associate_product">Associar Produto</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Parâmetro / Valor"
                    value={form.actionValue}
                    onChange={(e) => setForm({ ...form, actionValue: e.target.value })}
                    className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 text-sm border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || !form.conditionValue || !form.actionValue}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Criar Regra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
