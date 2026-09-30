"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Receipt, Tag } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  recurrence: string;
  notes?: string;
  isActive: boolean;
};

const CATEGORIES = [
  { value: "agency", label: "Agência" },
  { value: "tools", label: "Ferramentas" },
  { value: "employees", label: "Funcionários" },
  { value: "domain", label: "Domínio" },
  { value: "hosting", label: "Hospedagem" },
  { value: "creatives", label: "Criativos" },
  { value: "shipping", label: "Frete" },
  { value: "other", label: "Outros" },
];

const RECURRENCES = [
  { value: "one_time", label: "Único" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find((c) => c.value === category);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      {cat?.label || category}
    </span>
  );
}

function ExpenseModal({
  expense,
  onClose,
  onSave,
}: {
  expense?: Expense | null;
  onClose: () => void;
  onSave: (data: Partial<Expense>) => void;
}) {
  const [form, setForm] = useState({
    name: expense?.name || "",
    category: expense?.category || "tools",
    amount: expense?.amount?.toString() || "",
    date: expense?.date ? expense.date.split("T")[0] : new Date().toISOString().split("T")[0],
    recurrence: expense?.recurrence || "one_time",
    notes: expense?.notes || "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
          {expense ? "Editar Despesa" : "Nova Despesa"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Ex: Assinatura Adobe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recorrência</label>
              <select
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                {RECURRENCES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave({ ...form, amount: parseFloat(form.amount) || 0 })}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ expenses: Expense[]; total: number }>({
    queryKey: ["expenses"],
    queryFn: () => fetch("/api/expenses").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: Partial<Expense>) =>
      fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: (body: Partial<Expense>) =>
      fetch(`/api/expenses/${editingExpense?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); setEditingExpense(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const expenses = data?.expenses || [];
  const totalMonthly = expenses
    .filter((e) => e.isActive)
    .reduce((sum, e) => {
      if (e.recurrence === "monthly") return sum + e.amount;
      if (e.recurrence === "yearly") return sum + e.amount / 12;
      return sum;
    }, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Despesas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gerencie suas despesas operacionais</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nova Despesa
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total de Despesas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{expenses.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Custo Mensal Estimado</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Custo Anual Estimado</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{formatCurrency(totalMonthly * 12)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Categoria</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Recorrência</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Data</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Receipt className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">Nenhuma despesa cadastrada</p>
                    <button onClick={() => setShowModal(true)} className="mt-2 text-blue-600 text-sm hover:underline">
                      Adicionar primeira despesa
                    </button>
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{expense.name}</td>
                    <td className="px-4 py-3"><CategoryBadge category={expense.category} /></td>
                    <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">{formatCurrency(expense.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {RECURRENCES.find((r) => r.value === expense.recurrence)?.label}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingExpense(expense); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Deletar esta despesa?")) deleteMutation.mutate(expense.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <ExpenseModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMutation.mutate(data)}
        />
      )}
      {editingExpense && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={(data) => updateMutation.mutate(data)}
        />
      )}
    </div>
  );
}
