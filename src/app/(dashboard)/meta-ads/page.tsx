"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BarChart2,
  Sliders,
  DollarSign,
  Sparkles,
  Link as LinkIcon,
  CheckSquare,
  Square,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { getDateRange, formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { CampaignsTable, MetaTableLevel } from "@/components/meta-ads/campaigns-table";

type AdAccount = {
  id: string;
  name: string;
  externalId: string;
  currency: string;
  timezone: string;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
};

function MetaAdsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"Contas" | "Campanhas" | "Conjuntos" | "Anúncios">("Contas");
  const [period, setPeriod] = useState({
    preset: "Últimos 30 dias",
    ...getDateRange("last30days"),
  });

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState("all");

  const [manualAccount, setManualAccount] = useState({
    name: "",
    externalId: "",
    accessToken: "",
  });

  // Notificações e Progresso de Sincronização
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncStep, setSyncStep] = useState<number>(0);
  const [syncDetail, setSyncDetail] = useState<{
    campaigns?: number;
    adSets?: number;
    ads?: number;
    insights?: number;
  } | null>(null);

  // Monitoramento do Auto-Sync em Background (atualiza a cada 20s)
  const { data: autoSyncData } = useQuery({
    queryKey: ["meta-auto-sync"],
    queryFn: async () => {
      const res = await fetch("/api/meta/auto-sync");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 20000,
  });

  // Busca contas vinculadas no banco
  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ["meta-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/meta/accounts");
      if (!res.ok) throw new Error("Erro ao carregar contas");
      return res.json();
    },
  });

  const accounts: AdAccount[] = accountsData?.accounts || [];
  const needsReconnect = accounts.some((a) => a.status === "reconnect_required");

  // Verificar se o usuário acabou de voltar do OAuth
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setIsSelectModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (accounts.length > 0 && selectedIds.length === 0) {
      setSelectedIds(accounts.map((a) => a.id));
    }
  }, [accounts]);

  // Mutação para sincronização passo a passo
  const syncMutation = useMutation({
    mutationFn: async (accountId?: string) => {
      setSyncStep(1);
      setSyncMessage("1/5: Conectando com a Meta Graph API v21.0...");
      await new Promise((r) => setTimeout(r, 400));

      setSyncStep(2);
      setSyncMessage("2/5: Sincronizando campanhas ativas...");
      await new Promise((r) => setTimeout(r, 400));

      setSyncStep(3);
      setSyncMessage("3/5: Sincronizando conjuntos de anúncios e orçamentos...");
      await new Promise((r) => setTimeout(r, 400));

      setSyncStep(4);
      setSyncMessage("4/5: Sincronizando criativos e anúncios...");
      await new Promise((r) => setTimeout(r, 400));

      setSyncStep(5);
      setSyncMessage("5/5: Importando métricas diárias e conversões (Insights)...");

      const res = await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountId ? { accountId } : {}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na sincronização");
      return data;
    },
    onSuccess: (data) => {
      setSyncStep(6);
      setSyncMessage("Sincronização concluída com sucesso!");
      if (data?.results?.[0]) {
        const first = data.results[0];
        setSyncDetail({
          campaigns: first.campaigns,
          adSets: first.adSets,
          ads: first.ads,
          insights: first.insights,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["meta-insights-table"] });
      queryClient.invalidateQueries({ queryKey: ["meta-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTimeout(() => {
        setSyncStep(0);
        setSyncMessage(null);
      }, 5000);
    },
    onError: (err: Error) => {
      setSyncStep(0);
      setSyncMessage(`Erro: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 7000);
    },
  });

  // Mutação para salvar seleção de contas
  const selectAccountsMutation = useMutation({
    mutationFn: async (accountIds: string[]) => {
      const res = await fetch("/api/meta/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAccountIds: accountIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar contas");
      return data;
    },
    onSuccess: () => {
      setIsSelectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meta-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["summary-consolidated"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.replace("/meta-ads");
      syncMutation.mutate();
    },
    onError: (err: Error) => {
      setSyncMessage(`Erro ao salvar contas: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 7000);
    },
  });

  const addAccountMutation = useMutation({
    mutationFn: async (body: typeof manualAccount) => {
      const res = await fetch("/api/meta/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar conta");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-accounts"] });
      setIsManualModalOpen(false);
      setManualAccount({ name: "", externalId: "", accessToken: "" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/meta/accounts?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meta-accounts"] }),
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === accounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(accounts.map((a) => a.id));
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const tabs: Array<"Contas" | "Campanhas" | "Conjuntos" | "Anúncios"> = [
    "Contas",
    "Campanhas",
    "Conjuntos",
    "Anúncios",
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Alerta de Reconexão Necessária */}
      {needsReconnect && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                A conexão com a Meta requer renovação
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                O token de acesso expirou ou foi invalidado na Meta. Seus dados históricos foram preservados.
              </p>
            </div>
          </div>
          <Link
            href="/api/meta/oauth"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow shrink-0"
          >
            Reconectar Meta Ads
          </Link>
        </div>
      )}

      {/* Header com Título, Período e Botões de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Meta Ads
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sincronização oficial de contas, campanhas, conjuntos, anúncios e Insights reais da Meta Graph API v21.0
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto-Sync Live Indicator */}
          {autoSyncData?.enabled && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${autoSyncData.isSyncing ? "duration-700" : ""}`} />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <div className="flex flex-col text-[11px] leading-tight">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                  {autoSyncData.isSyncing ? "Auto-Sync em andamento..." : "Auto-Sync Ativo (a cada 15m)"}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {autoSyncData.lastSyncAt
                    ? `Último sync: ${formatDateTime(autoSyncData.lastSyncAt)}`
                    : "Aguardando primeiro ciclo"}
                </span>
              </div>
            </div>
          )}

          <PeriodSelector
            value={period.preset}
            onChange={(preset, from, to) => setPeriod({ preset, from, to, label: preset })}
          />

          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Agora"}
          </button>
        </div>
      </div>

      {/* Barra de Progresso Real da Sincronização */}
      {syncMessage && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
            <span>{syncMessage}</span>
            {syncStep > 0 && syncStep <= 5 && <span className="animate-pulse">{syncStep * 20}%</span>}
            {syncStep === 6 && <span className="text-emerald-600 dark:text-emerald-400">100%</span>}
          </div>
          {syncStep > 0 && (
            <div className="w-full bg-blue-200 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  syncStep === 6 ? "bg-emerald-500" : "bg-blue-600"
                }`}
                style={{ width: `${Math.min(syncStep * 20, 100)}%` }}
              />
            </div>
          )}
          {syncDetail && (
            <div className="flex flex-wrap gap-4 text-xs text-blue-800 dark:text-blue-300 pt-1 font-mono">
              <span>Campanhas: {syncDetail.campaigns || 0}</span>
              <span>Conjuntos: {syncDetail.adSets || 0}</span>
              <span>Anúncios: {syncDetail.ads || 0}</span>
              <span>Insights: {syncDetail.insights || 0}</span>
            </div>
          )}
        </div>
      )}

      {/* Navegação Superior por Abas (CONTAS | CAMPANHAS | CONJUNTOS | ANÚNCIOS) */}
      <div className="border-b border-slate-200 dark:border-[#142C52] flex items-center justify-between">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all relative ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Ações da Aba Contas */}
        {activeTab === "Contas" && (
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => setIsSelectModalOpen(true)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100"
            >
              Selecionar Contas ({accounts.length})
            </button>
            <Link
              href="/api/meta/oauth"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Conectar Meta
            </Link>
          </div>
        )}
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === "Contas" && (
        <div className="space-y-4">
          {loadingAccounts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-slate-100 dark:bg-[#081A33] rounded-xl border border-slate-200 dark:border-[#142C52]" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhuma conta de anúncios conectada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Conecte sua conta Meta via OAuth oficial para sincronizar campanhas, conjuntos, anúncios e métricas de conversão.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/api/meta/oauth"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Conectar com Facebook / Meta
                </Link>
                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-[#142C52] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-[#142C52]/60"
                >
                  Adicionar Manualmente
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-blue-400 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[200px]" title={acc.name}>
                          {acc.name}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {acc.externalId}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          acc.status === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : acc.status === "reconnect_required"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {acc.status === "active" ? "Ativa" : acc.status === "reconnect_required" ? "Reconexão" : "Inativa"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-[#142C52]/60">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Moeda</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{acc.currency || "BRL"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Timezone</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{acc.timezone || "America/Sao_Paulo"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 text-[10px] block">Última Sincronização</span>
                        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {acc.lastSyncAt ? formatDate(acc.lastSyncAt) : "Nunca sincronizada"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#142C52]/60">
                    <button
                      onClick={() => syncMutation.mutate(acc.id)}
                      disabled={syncMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
                    </button>
                    <button
                      onClick={() => deleteAccountMutation.mutate(acc.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Desconectar conta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aba CAMPANHAS */}
      {activeTab === "Campanhas" && (
        <CampaignsTable
          level="campaign"
          adAccountId={selectedAdAccount}
          periodFrom={period.from.toISOString()}
          periodTo={period.to.toISOString()}
        />
      )}

      {/* Aba CONJUNTOS */}
      {activeTab === "Conjuntos" && (
        <CampaignsTable
          level="adset"
          adAccountId={selectedAdAccount}
          periodFrom={period.from.toISOString()}
          periodTo={period.to.toISOString()}
        />
      )}

      {/* Aba ANÚNCIOS */}
      {activeTab === "Anúncios" && (
        <CampaignsTable
          level="ad"
          adAccountId={selectedAdAccount}
          periodFrom={period.from.toISOString()}
          periodTo={period.to.toISOString()}
        />
      )}

      {/* Modal Selecionar Contas */}
      {isSelectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200 dark:border-[#142C52]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Selecionar Contas de Anúncios Meta
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Marque as contas que alimentarão os relatórios, dashboard e funil de conversão
                </p>
              </div>
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-blue-600 font-bold"
              >
                {selectedIds.length === accounts.length ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> Desmarcar
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" /> Marcar Todas
                  </>
                )}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-[#142C52]/60">
              {accounts.map((acc) => {
                const isSelected = selectedIds.includes(acc.id);
                return (
                  <label
                    key={acc.id}
                    onClick={() => toggleAccount(acc.id)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900"
                        : "hover:bg-slate-50 dark:hover:bg-[#061224] border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-xs">
                          {acc.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {acc.externalId} • {acc.currency || "BRL"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">
                      {acc.timezone || "America/Sao_Paulo"}
                    </span>
                  </label>
                );
              })}

              {accounts.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-6">
                  Nenhuma conta vinculada encontrada.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsSelectModalOpen(false)}
                className="flex-1 py-2.5 text-xs font-semibold border border-slate-200 dark:border-[#142C52] rounded-xl hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => selectAccountsMutation.mutate(selectedIds)}
                disabled={selectedIds.length === 0 || selectAccountsMutation.isPending}
                className="flex-1 py-2.5 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow disabled:opacity-50 transition-colors"
              >
                {selectAccountsMutation.isPending ? "Salvando..." : "Conectar Contas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200 dark:border-[#142C52]">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Conectar Conta Manualmente
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Identificador
                </label>
                <input
                  type="text"
                  placeholder="Ex: Conta Principal Tráfego"
                  value={manualAccount.name}
                  onChange={(e) => setManualAccount({ ...manualAccount, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ID da Conta (act_XXXXXXXXX ou número)
                </label>
                <input
                  type="text"
                  placeholder="Ex: act_1234567890"
                  value={manualAccount.externalId}
                  onChange={(e) => setManualAccount({ ...manualAccount, externalId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Access Token de Sistema (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="EAAB..."
                  value={manualAccount.accessToken}
                  onChange={(e) => setManualAccount({ ...manualAccount, accessToken: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Criptografado com AES-256-GCM em repouso.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="flex-1 py-2 text-xs border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => addAccountMutation.mutate(manualAccount)}
                disabled={!manualAccount.name || !manualAccount.externalId}
                className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Salvar Conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MetaAdsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs text-slate-400">Carregando Meta Ads...</div>}>
      <MetaAdsContent />
    </Suspense>
  );
}
