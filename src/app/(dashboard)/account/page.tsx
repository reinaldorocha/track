"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Shield, KeyRound, Building, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { UtmTrackSymbol } from "@/components/brand/symbol";

export default function AccountPage() {
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["user-account"],
    queryFn: async () => {
      const res = await fetch("/api/account");
      if (!res.ok) throw new Error("Erro ao buscar dados da conta");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.user?.name) {
      setName(data.user.name);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { name?: string; currentPassword?: string; newPassword?: string }) => {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Erro ao salvar alterações");
      return resData;
    },
    onSuccess: () => {
      setMessage({ type: "success", text: "Dados atualizados com sucesso!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      refetch();
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (err: Error) => {
      setMessage({ type: "error", text: err.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "As novas senhas não coincidem" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "A nova senha deve ter no mínimo 8 caracteres" });
      return;
    }
    updateMutation.mutate({ currentPassword, newPassword });
  };

  const user = data?.user;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <UtmTrackSymbol size={28} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Minha Conta</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gerencie suas informações cadastrais, workspaces e segurança de acesso
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
              : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40"
          }`}
        >
          {message.type === "success" && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Profile Details Card */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <User className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Dados do Perfil</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail Cadastrado</label>
            <input
              type="email"
              disabled
              value={user?.email || ""}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 text-sm cursor-not-allowed"
            />
            <p className="text-[11px] text-gray-400 mt-1">O e-mail é utilizado para login e segurança do workspace.</p>
          </div>

          <div className="text-xs text-gray-500">
            Cadastrado em: <span className="font-medium text-gray-700 dark:text-gray-300">{user?.createdAt ? formatDate(user.createdAt) : "—"}</span>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending || !name}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Salvar Alterações
          </button>
        </form>
      </div>

      {/* Workspaces List */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <Building className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Workspaces Vinculados</h2>
        </div>

        <div className="space-y-2">
          {user?.memberships?.map((m: { id: string; role: string; workspace: { id: string; name: string; slug: string } }) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-sm"
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{m.workspace.name}</p>
                <p className="text-xs text-gray-400 font-mono">slug: {m.workspace.slug}</p>
              </div>
              <span className="uppercase text-xs font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Security Card */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <KeyRound className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Segurança & Alterar Senha</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Senha Atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending || !currentPassword || !newPassword}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            Atualizar Senha
          </button>
        </form>
      </div>
    </div>
  );
}
