"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Settings, Shield, Globe, Users, CheckCircle2, Bell, Volume2, ArrowRight } from "lucide-react";
import { UtmTrackLogo } from "@/components/brand/logo";
import { UtmTrackSymbol } from "@/components/brand/symbol";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [currency, setCurrency] = useState("BRL");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Erro ao carregar configurações");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.workspace) {
      setName(data.workspace.name || "");
      setTimezone(data.workspace.timezone || "America/Sao_Paulo");
      setCurrency(data.workspace.currency || "BRL");
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; timezone: string; currency: string }) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Erro ao salvar");
      return resData;
    },
    onSuccess: () => {
      setMessage({ type: "success", text: "Configurações salvas com sucesso!" });
      refetch();
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (err: Error) => {
      setMessage({ type: "error", text: err.message });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, timezone, currency });
  };

  const ws = data?.workspace;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações do Workspace</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Defina as preferências de fuso horário, moeda, segurança criptográfica e membros da equipe
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

      {/* General Settings */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <Globe className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Preferências Regionais & Workspace</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Workspace</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Identificador Único (Slug)</label>
            <input
              type="text"
              disabled
              value={ws?.slug || ""}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fuso Horário</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              >
                <option value="America/Sao_Paulo">América/São Paulo (BRT)</option>
                <option value="America/New_York">América/New York (EST)</option>
                <option value="Europe/London">Europa/Londres (GMT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Moeda Padrão</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              >
                <option value="BRL">Real Brasileiro (R$)</option>
                <option value="USD">Dólar Americano ($)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending || !name}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Salvar Preferências
          </button>
        </form>
      </div>

      {/* Notifications & Push Preferences */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Alertas & Push Notifications</h2>
          </div>
          <Link
            href="/settings/notifications"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
          >
            Personalizar Alertas <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Configure preferências por usuário para alertas de Venda Aprovada, Pix Gerado, Reembolsos, Chargebacks, canais de som oficiais e vibração háptica.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
            💰 Venda Aprovada
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium">
            ⚡ Pix Gerado
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium">
            ⏳ Venda Pendente
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
            🔊 5 Sons Nativos
          </span>
        </div>
      </div>

      {/* Security Status */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Segurança & Criptografia</h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Criptografia em Repouso Ativa</p>
              <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                Tokens de acesso do Meta Ads e segredos de webhook são cifrados com AES-256-GCM.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-700 bg-white dark:bg-gray-900 px-2.5 py-1 rounded">
              AES-256
            </span>
          </div>

          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
            <span className="text-gray-500 font-medium">Proteção do Frontend:</span>
            <p className="text-gray-700 dark:text-gray-300 mt-1">
              Nenhuma chave secreta ou token em texto limpo é transmitido ou exibido nos componentes do navegador.
            </p>
          </div>
        </div>

        {/* Biometric Devices link */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">🔑 Dispositivos com Biometria</p>
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">Gerencie dispositivos autorizados para login biométrico (impressão digital / Face ID).</p>
          </div>
          <Link href="/settings/security" className="ml-3 shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#0066FF] hover:underline">
            Gerenciar <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Workspace Members */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <Users className="w-5 h-5 text-purple-600" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Membros da Equipe</h2>
        </div>

        <div className="space-y-2">
          {ws?.members?.map((m: { id: string; role: string; user: { id: string; name: string; email: string } }) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs"
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{m.user.name || "Sem nome"}</p>
                <p className="text-gray-400">{m.user.email}</p>
              </div>
              <span className="uppercase font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Official Brand Identity & Assets */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <UtmTrackSymbol size={22} />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Identidade Visual & Marca Oficial</h2>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
            Design System 1.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-3">
            <p className="font-semibold text-gray-700 dark:text-gray-200">Logotipos Oficiais</p>
            <div className="p-3 bg-white rounded border border-gray-200 flex items-center justify-center">
              <UtmTrackLogo size="md" showTagline />
            </div>
            <div className="p-3 bg-[#081A33] rounded border border-gray-800 flex items-center justify-center">
              <UtmTrackLogo size="md" showTagline />
            </div>
            <div className="flex gap-2 pt-1">
              <a 
                href="/brand/logo/logo-light.png" 
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Versão Clara (PNG)
              </a>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <a 
                href="/brand/logo/logo-dark.png" 
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Versão Escura (PNG)
              </a>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-3">
            <p className="font-semibold text-gray-700 dark:text-gray-200">Paleta Cromática & Tipografia</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="h-8 rounded bg-[#0066FF] shadow-inner" />
                <span className="text-[10px] text-gray-500 font-mono mt-1 block">#0066FF</span>
              </div>
              <div className="text-center">
                <div className="h-8 rounded bg-[#00D4FF] shadow-inner" />
                <span className="text-[10px] text-gray-500 font-mono mt-1 block">#00D4FF</span>
              </div>
              <div className="text-center">
                <div className="h-8 rounded bg-[#081A33] shadow-inner" />
                <span className="text-[10px] text-gray-500 font-mono mt-1 block">#081A33</span>
              </div>
              <div className="text-center">
                <div className="h-8 rounded bg-[#39E6FF] shadow-inner" />
                <span className="text-[10px] text-gray-500 font-mono mt-1 block">#39E6FF</span>
              </div>
            </div>
            <p className="text-gray-500">
              Fontes: <span className="font-semibold text-gray-700 dark:text-gray-300">Inter</span> (UI/Métricas) e <span className="font-semibold text-gray-700 dark:text-gray-300">Manrope</span> (Títulos/Marca).
            </p>
            <div className="flex gap-2 pt-1">
              <a 
                href="/brand/guidelines/brand-palette-guide.png" 
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Guia de Cores
              </a>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <a 
                href="/brand/guidelines/brand-typography-guide.png" 
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Guia Tipográfico
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
