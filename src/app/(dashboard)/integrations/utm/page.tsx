"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link2,
  Copy,
  Check,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Info,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

interface UtmLinkItem {
  id: string;
  name?: string | null;
  destinationUrl: string;
  fullUrl: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  clicks: number;
  createdAt: string;
}

export default function TrackingAndUtmHubPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"SETUP" | "UTM_GENERATOR" | "GUIDE" | "DIAGNOSTICS">("SETUP");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados do Gerador de Links UTM
  const [formData, setFormData] = useState({
    url: "",
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "escala_principal",
    utm_content: "video_01",
    utm_term: "feed",
    adAccountId: "",
    campaignId: "",
    adSetId: "",
    adId: ""
  });
  const [generatedUrl, setGeneratedUrl] = useState("");

  // Estados do Modal de Pixel
  const [isPixelModalOpen, setIsPixelModalOpen] = useState(false);
  const [pixelForm, setPixelForm] = useState({
    name: "",
    pixelId: "",
    accessToken: "",
    testEventCode: "",
    environment: "production"
  });

  // Estados de Feedback de Testes
  const [testNotification, setTestNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isTestingTracker, setIsTestingTracker] = useState(false);

  // 1. Query: Diagnósticos do Rastreamento
  const { data: diagData, isLoading: isLoadingDiag, refetch: refetchDiag } = useQuery({
    queryKey: ["tracking-diagnostics"],
    queryFn: async () => {
      const res = await fetch("/api/tracking/diagnostics");
      if (!res.ok) throw new Error("Erro ao carregar diagnósticos");
      return res.json();
    }
  });

  // 2. Query: Links UTM
  const { data: linksData, refetch: refetchLinks } = useQuery<{ links: UtmLinkItem[] }>({
    queryKey: ["utm-links"],
    queryFn: async () => {
      const res = await fetch("/api/utm/links");
      if (!res.ok) return { links: [] };
      return res.json();
    }
  });

  // 3. Query: Pixels
  const { data: pixelsData, refetch: refetchPixels } = useQuery({
    queryKey: ["pixels-list"],
    queryFn: async () => {
      const res = await fetch("/api/pixels");
      if (!res.ok) return { pixels: [] };
      return res.json();
    }
  });

  // 4. Query: Webhooks Genéricos
  const { data: genericEndpointsData, refetch: refetchGeneric } = useQuery({
    queryKey: ["generic-endpoints"],
    queryFn: async () => {
      const res = await fetch("/api/webhooks/generic");
      if (!res.ok) return { endpoints: [] };
      return res.json();
    }
  });

  const appUrl = diagData?.appUrl || (typeof window !== "undefined" ? window.location.origin : "https://utm-track-navy.vercel.app");
  const workspaceId = diagData?.workspace?.id || "SEU_WORKSPACE_ID";
  const links = linksData?.links || [];
  const pixels = pixelsData?.pixels || [];
  const genericEndpoints = genericEndpointsData?.endpoints || [];

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setTestNotification({ type, message });
    setTimeout(() => setTestNotification(null), 6000);
  };

  // Gerar Link UTM
  const handleGenerateLink = async () => {
    if (!formData.url) {
      showNotification("error", "Por favor, informe a URL de destino");
      return;
    }
    try {
      const res = await fetch("/api/utm/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.link) {
        setGeneratedUrl(data.link.fullUrl);
        refetchLinks();
        showNotification("success", "Link UTM gerado e salvo com sucesso!");
      }
    } catch {
      showNotification("error", "Erro ao gerar link UTM");
    }
  };

  // Deletar Link UTM
  const handleDeleteLink = async (id: string) => {
    if (!confirm("Deseja excluir este link?")) return;
    await fetch(`/api/utm/links?id=${id}`, { method: "DELETE" });
    refetchLinks();
    showNotification("info", "Link removido.");
  };

  // Salvar Pixel
  const handleSavePixel = async () => {
    if (!pixelForm.name || !pixelForm.pixelId) {
      showNotification("error", "Nome e Pixel ID são obrigatórios");
      return;
    }
    try {
      const res = await fetch("/api/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pixelForm)
      });
      if (res.ok) {
        setIsPixelModalOpen(false);
        setPixelForm({ name: "", pixelId: "", accessToken: "", testEventCode: "", environment: "production" });
        refetchPixels();
        refetchDiag();
        showNotification("success", "Meta Pixel e credenciais CAPI salvos com sucesso!");
      }
    } catch {
      showNotification("error", "Erro ao salvar Pixel");
    }
  };

  // Deletar Pixel
  const handleDeletePixel = async (id: string) => {
    if (!confirm("Deseja remover este Pixel?")) return;
    await fetch(`/api/pixels?id=${id}`, { method: "DELETE" });
    refetchPixels();
    refetchDiag();
    showNotification("info", "Pixel removido.");
  };

  // Testar CAPI Pixel
  const handleTestPixelCapi = async (pixelId: string) => {
    showNotification("info", "Disparando evento de teste para a Meta Conversions API (CAPI)...");
    try {
      const res = await fetch("/api/meta/pixel/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixelId,
          eventName: "PageView",
          sourceUrl: window.location.href
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification("success", "✅ Evento CAPI PageView enviado com sucesso para a Meta!");
      } else {
        showNotification("error", `❌ Falha ao enviar para Meta CAPI: ${data.error || "Verifique o Access Token"}`);
      }
    } catch (err: any) {
      showNotification("error", `❌ Erro na comunicação com Meta CAPI: ${err.message}`);
    }
  };

  // Testar Instalação do Tracker
  const handleTestTracker = async () => {
    setIsTestingTracker(true);
    showNotification("info", "Enviando ping de teste para o endpoint de tracking...");
    try {
      const res = await fetch("/api/tracking/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "tracker_ping",
          eventName: "PageView",
          sourceUrl: window.location.href
        })
      });
      const data = await res.json();
      if (data.success) {
        refetchDiag();
        showNotification("success", "✅ Ping de rastreamento recebido! Sessão e evento registrados no banco.");
      } else {
        showNotification("error", "Erro ao testar tracker.");
      }
    } catch {
      showNotification("error", "Falha de conexão com o servidor.");
    } finally {
      setIsTestingTracker(false);
    }
  };

  // Testar Webhook Gateway
  const handleTestWebhook = async (gateway: "hotmart" | "cakto" | "yampi") => {
    showNotification("info", `Disparando evento simulado para o webhook do ${gateway}...`);
    try {
      let res;
      if (gateway === "hotmart") {
        res = await fetch("/api/webhooks/hotmart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `test_hotmart_${Date.now()}`,
            event: "PURCHASE_APPROVED",
            data: {
              purchase: {
                transaction: `HP_TEST_${Date.now()}`,
                price: { value: 197.0 },
                status: "APPROVED",
                tracking: { source: "meta_ads", campaign: "campanha_teste" }
              },
              buyer: { email: "comprador@teste.com", name: "Cliente Teste" }
            }
          })
        });
      } else if (gateway === "cakto") {
        res = await fetch("/api/webhooks/cakto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `test_cakto_${Date.now()}`,
            status: "approved",
            amount: 97.0,
            currency: "BRL",
            email: "teste@utmtrack.com",
            utms: { source: "meta_ads", campaign: "campanha_teste" }
          })
        });
      } else {
        res = await fetch("/api/webhooks/yampi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "order.paid",
            order: {
              id: `test_yampi_${Date.now()}`,
              status: { alias: "payment_approved" },
              value_total: 147.0,
              customer: { email: "cliente@yampi.com" }
            }
          })
        });
      }

      if (res && res.ok) {
        refetchDiag();
        showNotification("success", `✅ Webhook do ${gateway} respondeu com sucesso (HTTP 200)!`);
      } else {
        showNotification("error", `Erro ao validar webhook do ${gateway}.`);
      }
    } catch {
      showNotification("error", `Falha ao conectar com o endpoint de webhook.`);
    }
  };

  const scriptSnippet = `<script 
  src="${appUrl}/tracker.js" 
  data-api-url="${appUrl}" 
  data-workspace-id="${workspaceId}" 
  async
></script>`;

  const metaDynamicParams = "utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&src={{site_source_name}}&sck={{campaign.name}}";

  const isTrackerActive = diagData?.tracker?.status === "ACTIVE";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1500px] mx-auto animate-in fade-in duration-300">
      {/* Toast Notification */}
      {testNotification && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border text-sm max-w-md animate-in slide-in-from-bottom-5 ${
            testNotification.type === "success"
              ? "bg-emerald-900/90 text-emerald-100 border-emerald-700"
              : testNotification.type === "error"
              ? "bg-rose-900/90 text-rose-100 border-rose-700"
              : "bg-blue-900/90 text-blue-100 border-blue-700"
          }`}
        >
          {testNotification.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {testNotification.type === "error" && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {testNotification.type === "info" && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
          <span className="flex-1 font-medium">{testNotification.message}</span>
          <button onClick={() => setTestNotification(null)} className="text-white/70 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Link2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
              UTMs & Configuração de Rastreamento
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Central de inteligência para rastreamento de anúncios Meta Ads, Pixel CAPI, Tracker de páginas e Webhooks de checkout
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/utm"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-[#0E2547] hover:bg-slate-200 dark:hover:bg-[#142C52] text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Dashboard de Performance
          </Link>
          <button
            onClick={() => { refetchDiag(); refetchPixels(); refetchLinks(); }}
            className="p-2 bg-slate-100 dark:bg-[#0E2547] hover:bg-slate-200 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300 rounded-lg text-xs"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards de Status Rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white dark:bg-[#081A33] p-4 rounded-xl border border-slate-200 dark:border-[#142C52] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tracker da Página</span>
            <span className={`w-2.5 h-2.5 rounded-full ${isTrackerActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {isTrackerActive ? "Ativo" : "Aguardando"}
            </span>
            <span className="text-[11px] text-slate-400">
              ({diagData?.tracker?.totalEvents || 0} eventos)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#081A33] p-4 rounded-xl border border-slate-200 dark:border-[#142C52] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Meta Pixels & CAPI</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {pixels.length} {pixels.length === 1 ? "Pixel" : "Pixels"}
            </span>
            <span className="text-[11px] text-emerald-500 font-medium">
              ({pixels.filter((p: any) => p.status === "active").length} ativos)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#081A33] p-4 rounded-xl border border-slate-200 dark:border-[#142C52] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contas Meta Ads</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {diagData?.metaAds?.connectedCount || 0}
            </span>
            <span className="text-[11px] text-slate-400">contas conectadas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#081A33] p-4 rounded-xl border border-slate-200 dark:border-[#142C52] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Taxa de Atribuição</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {diagData?.attribution?.attributionRate || 0}%
            </span>
            <span className="text-[11px] text-slate-400">
              ({diagData?.attribution?.attributedSales || 0} de {diagData?.attribution?.totalSales || 0} vendas)
            </span>
          </div>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="border-b border-slate-200 dark:border-[#142C52] flex space-x-1 overflow-x-auto">
        {[
          { id: "SETUP", label: "Central de Rastreamento", icon: Layers },
          { id: "UTM_GENERATOR", label: "Gerador de Links UTM", icon: Link2 },
          { id: "GUIDE", label: "Guia Passo a Passo", icon: HelpCircle },
          { id: "DIAGNOSTICS", label: "Diagnóstico & Logs", icon: Activity }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs md:text-sm font-bold tracking-wide transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? "text-blue-600 dark:text-cyan-400 border-blue-600 dark:border-cyan-400 bg-blue-50/50 dark:bg-blue-950/20"
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CENTRAL DE RASTREAMENTO */}
      {/* ========================================================================= */}
      {activeTab === "SETUP" && (
        <div className="space-y-6">
          {/* Seção 1: Script da Página de Venda */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                    ETAPA FUNDAMENTAL
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Script de Rastreamento (Página de Venda)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Instale este código na sua página de venda para que o UTM-Track capture visitantes, cliques, UTMs, identificadores da Meta (<code className="font-mono text-[11px]">fbclid, fbp, fbc</code>) e sessões necessárias para a atribuição.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isTrackerActive 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isTrackerActive ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {isTrackerActive ? "Tracker Ativo" : "Não testado"}
                </span>
              </div>
            </div>

            {/* Snippet com Copiar */}
            <div className="relative">
              <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
                {scriptSnippet}
              </pre>
              <button
                onClick={() => copyToClipboard(scriptSnippet, "tracker_script")}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
              >
                {copiedKey === "tracker_script" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === "tracker_script" ? "Copiado!" : "COPIAR SCRIPT"}
              </button>
            </div>

            {/* Barra de Ações do Tracker */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-[#142C52]">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Ultraleve (&lt;3KB)
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Não bloqueante (<code className="font-mono text-[10px]">async</code>)
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Persistência de Cookies Meta
                </span>
              </div>

              <button
                onClick={handleTestTracker}
                disabled={isTestingTracker}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#0E2547] dark:hover:bg-[#142C52] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                {isTestingTracker ? "Testando..." : "TESTAR INSTALAÇÃO"}
              </button>
            </div>
          </div>

          {/* Seção 2: Parâmetros Dinâmicos para Meta Ads */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  META ADS
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Parâmetros Dinâmicos para Anúncios do Meta Ads
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Use estes parâmetros oficiais no campo &quot;Parâmetros da URL&quot; do anúncio para identificar automaticamente campanha, conjunto de anúncios e criativo.
              </p>
            </div>

            <div className="relative">
              <div className="p-3.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl font-mono text-xs text-blue-600 dark:text-cyan-400 break-all pr-36 leading-relaxed">
                {metaDynamicParams}
              </div>
              <button
                onClick={() => copyToClipboard(metaDynamicParams, "meta_params")}
                className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
              >
                {copiedKey === "meta_params" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === "meta_params" ? "Copiado!" : "COPIAR PARÂMETROS"}
              </button>
            </div>

            {/* Alerta de fbclid & Como Usar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Sobre o FBCLID (Automático)
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-300/80 leading-relaxed">
                  <strong>Não coloque manualmente o fbclid.</strong> O Meta Ads anexa o <code className="font-mono text-[11px]">fbclid</code> automaticamente a cada clique e o nosso script o captura e armazena de forma transparente.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Como usar no Meta Ads Manager:</p>
                <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
                  <li>Abra o Gerenciador de Anúncios da Meta;</li>
                  <li>Edite o anúncio no nível de <strong>Anúncio</strong>;</li>
                  <li>Cole o texto acima no campo <strong>Parâmetros da URL</strong>;</li>
                  <li>Publique o anúncio.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Seção 3: Meta Pixel & Conversions API (CAPI) */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    CONVERSIONS API
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Meta Pixel & API de Conversões (CAPI)
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Integração server-side com deduplicação por <code className="font-mono text-[11px]">event_id</code>. Seu Access Token é armazenado exclusivamente no servidor com criptografia AES-256-GCM.
                </p>
              </div>

              <button
                onClick={() => setIsPixelModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Pixel
              </button>
            </div>

            {/* Tabela de Pixels */}
            <div className="overflow-x-auto border border-slate-200 dark:border-[#142C52] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-[#061224] border-b border-slate-200 dark:border-[#142C52] text-slate-500 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Pixel ID</th>
                    <th className="py-3 px-4">Ambiente</th>
                    <th className="py-3 px-4">Access Token (CAPI)</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]">
                  {pixels.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0E2547]/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{p.pixelId}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          {p.environment}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {p.accessTokenEnc || "••••••••••••"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTestPixelCapi(p.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded font-bold hover:bg-emerald-100 text-[11px]"
                            title="Testar envio CAPI"
                          >
                            <Play className="w-3 h-3" /> Testar CAPI
                          </button>
                          <button
                            onClick={() => handleDeletePixel(p.id)}
                            className="p-1 text-rose-500 hover:text-rose-700"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pixels.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhum pixel configurado. Clique em &quot;+ Adicionar Pixel&quot; para cadastrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção 4: Webhooks das Plataformas de Vendas */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 md:p-6 shadow-sm space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                  POSTBACKS
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Webhooks das Plataformas de Vendas
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cadastre a URL do UTM-Track no seu checkout para receber notificações de compra aprovada, Pix gerado, boleto e cancelamentos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hotmart */}
              <div className="p-4 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Hotmart</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                    Ativo
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">URL do Webhook:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${appUrl}/api/webhooks/hotmart`}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                    <button
                      onClick={() => copyToClipboard(`${appUrl}/api/webhooks/hotmart`, "hotmart_url")}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      {copiedKey === "hotmart_url" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Header: <code className="font-mono">x-hotmart-hottok</code></span>
                  <button
                    onClick={() => handleTestWebhook("hotmart")}
                    className="text-blue-600 dark:text-cyan-400 font-bold hover:underline"
                  >
                    Testar Webhook
                  </button>
                </div>
              </div>

              {/* Cakto */}
              <div className="p-4 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cakto</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                    Ativo
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">URL do Webhook:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${appUrl}/api/webhooks/cakto`}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                    <button
                      onClick={() => copyToClipboard(`${appUrl}/api/webhooks/cakto`, "cakto_url")}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      {copiedKey === "cakto_url" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Header: <code className="font-mono">x-cakto-signature</code></span>
                  <button
                    onClick={() => handleTestWebhook("cakto")}
                    className="text-blue-600 dark:text-cyan-400 font-bold hover:underline"
                  >
                    Testar Webhook
                  </button>
                </div>
              </div>

              {/* Yampi */}
              <div className="p-4 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Yampi</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                    Ativo
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">URL do Webhook:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${appUrl}/api/webhooks/yampi`}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                    <button
                      onClick={() => copyToClipboard(`${appUrl}/api/webhooks/yampi`, "yampi_url")}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      {copiedKey === "yampi_url" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Header: <code className="font-mono">Authorization (Bearer)</code></span>
                  <button
                    onClick={() => handleTestWebhook("yampi")}
                    className="text-blue-600 dark:text-cyan-400 font-bold hover:underline"
                  >
                    Testar Webhook
                  </button>
                </div>
              </div>

              {/* Shopify */}
              <div className="p-4 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Shopify</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                    Ativo
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">URL do Webhook:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${appUrl}/api/webhooks/shopify`}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                    <button
                      onClick={() => copyToClipboard(`${appUrl}/api/webhooks/shopify`, "shopify_url")}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      {copiedKey === "shopify_url" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400 text-[11px]">Header: <code className="font-mono">x-shopify-hmac-sha256</code></span>
                  <span className="text-emerald-600 font-semibold">HMAC Validado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GERADOR DE LINKS UTM */}
      {/* ========================================================================= */}
      {activeTab === "UTM_GENERATOR" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-[#081A33] p-6 rounded-xl shadow-sm border border-slate-200 dark:border-[#142C52] space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Criar Novo Link Rastreado</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Crie URLs individuais com parâmetros de campanha para influenciadores, bios e disparos
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                URL de Destino *
              </label>
              <input
                type="text"
                placeholder="https://seusite.com.br/produto"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">utm_source</label>
                <input
                  type="text"
                  placeholder="Ex: meta, facebook, instagram, influencer"
                  value={formData.utm_source}
                  onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">utm_medium</label>
                <input
                  type="text"
                  placeholder="Ex: cpc, story, feed, bio"
                  value={formData.utm_medium}
                  onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">utm_campaign</label>
                <input
                  type="text"
                  placeholder="Ex: lancamento_outubro"
                  value={formData.utm_campaign}
                  onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">utm_content</label>
                <input
                  type="text"
                  placeholder="Ex: video_01, carrossel"
                  value={formData.utm_content}
                  onChange={(e) => setFormData({ ...formData, utm_content: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">utm_term</label>
              <input
                type="text"
                placeholder="Ex: publico_lookalike"
                value={formData.utm_term}
                onChange={(e) => setFormData({ ...formData, utm_term: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-slate-900 dark:text-white text-xs"
              />
            </div>

            <button
              onClick={handleGenerateLink}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold shadow-md transition-colors"
            >
              <Link2 className="w-4 h-4" /> Gerar Link Rastreável
            </button>

            {generatedUrl && (
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                  Link Pronto para Uso:
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={generatedUrl}
                    className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-[#061224] text-xs font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedUrl, "gen_link")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 shadow"
                  >
                    {copiedKey === "gen_link" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === "gen_link" ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de Links Gerados */}
          <div className="bg-white dark:bg-[#081A33] rounded-xl shadow-sm border border-slate-200 dark:border-[#142C52] h-fit overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#142C52] flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">Links Gerados</h2>
              <span className="text-[11px] text-slate-400">{links.length} salvos</span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 dark:border-[#142C52] text-slate-500 bg-slate-50 dark:bg-[#061224]">
                  <tr>
                    <th className="py-2.5 px-3">Campanha</th>
                    <th className="py-2.5 px-3">URL</th>
                    <th className="text-right py-2.5 px-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]">
                  {links.map(link => (
                    <tr key={link.id} className="hover:bg-slate-50/50 dark:hover:bg-[#0E2547]/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{link.utmCampaign || "Geral"}</td>
                      <td className="py-2.5 px-3 truncate max-w-[120px] text-slate-500 font-mono text-[11px]" title={link.fullUrl}>
                        {link.fullUrl}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => copyToClipboard(link.fullUrl, link.id)} className="p-1 text-blue-600 hover:text-blue-700" title="Copiar">
                            {copiedKey === link.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleDeleteLink(link.id)} className="p-1 text-rose-500 hover:text-rose-700" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {links.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400">Nenhum link gerado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GUIA PASSO A PASSO (COMO INSTALAR EM 5 ETAPAS) */}
      {/* ========================================================================= */}
      {activeTab === "GUIDE" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* ETAPA 1 */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  1
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Configure seu Meta Pixel & CAPI</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadastre o Pixel ID e o Access Token gerado no Gerenciador de Eventos da Meta para ativar o envio server-side CAPI.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => { setActiveTab("SETUP"); setIsPixelModalOpen(true); }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#0E2547] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold"
                >
                  Adicionar Pixel
                </button>
              </div>
            </div>

            {/* ETAPA 2 */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  2
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Instale o Script na Página de Venda</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copie o script UTM-Track e cole no <code className="font-mono text-[11px]">&lt;head&gt;</code> ou antes de <code className="font-mono text-[11px]">&lt;/body&gt;</code> em todas as páginas do seu funil.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => copyToClipboard(scriptSnippet, "guide_script")}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  {copiedKey === "guide_script" ? "Copiado!" : "Copiar Script"}
                </button>
              </div>
            </div>

            {/* ETAPA 3 */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  3
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cole os Parâmetros no Meta Ads</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No Gerenciador de Anúncios, edite seu anúncio e cole a string no campo &quot;Parâmetros da URL&quot;.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => copyToClipboard(metaDynamicParams, "guide_params")}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  {copiedKey === "guide_params" ? "Copiado!" : "Copiar Parâmetros Meta"}
                </button>
              </div>
            </div>

            {/* ETAPA 4 */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  4
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cadastre o Webhook no Checkout</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Na Hotmart, Cakto, Yampi ou Shopify, cole a URL de Webhook correspondente para receber os pedidos aprovados em tempo real.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab("SETUP")}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#0E2547] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold"
                >
                  Ver URLs de Webhook
                </button>
              </div>
            </div>

            {/* ETAPA 5 */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                  5
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Teste o Rastreamento Completo</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Execute os testes no painel de diagnóstico para validar a recepção de eventos do script, CAPI e postback de vendas.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab("DIAGNOSTICS")}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  Abrir Diagnósticos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DIAGNÓSTICO & LOGS */}
      {/* ========================================================================= */}
      {activeTab === "DIAGNOSTICS" && (
        <div className="space-y-6">
          {/* Fluxo Visual do Funil */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Fluxo de Rastreamento & Atribuição</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs font-semibold">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1">
                <p className="text-blue-600 font-bold">1. ANÚNCIO META</p>
                <p className="text-[11px] text-slate-500">Parâmetros Dinâmicos</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1">
                <p className="text-blue-600 font-bold">2. PÁGINA DE VENDA</p>
                <p className="text-[11px] text-slate-500">Script UTM-Track</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1">
                <p className="text-blue-600 font-bold">3. SESSÃO & COOKIES</p>
                <p className="text-[11px] text-slate-500">fbclid, fbp, fbc, sid</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-1">
                <p className="text-blue-600 font-bold">4. WEBHOOK CHECKOUT</p>
                <p className="text-[11px] text-slate-500">Hotmart, Cakto, Yampi</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-1">
                <p className="text-emerald-600 font-bold">5. ATRIBUIÇÃO & LUCRO</p>
                <p className="text-[11px] text-slate-500">Dashboard em Tempo Real</p>
              </div>
            </div>
          </div>

          {/* Detalhes Técnicos dos Últimos Eventos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Último Evento do Tracker (Browser)</h3>
              {diagData?.tracker?.lastEvent ? (
                <div className="p-3 bg-slate-50 dark:bg-[#061224] rounded-lg text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
                  <p><strong>Evento:</strong> {diagData.tracker.lastEvent.eventName}</p>
                  <p><strong>Event ID:</strong> {diagData.tracker.lastEvent.eventId}</p>
                  <p><strong>Status:</strong> {diagData.tracker.lastEvent.status}</p>
                  <p><strong>Data:</strong> {new Date(diagData.tracker.lastEvent.eventTime).toLocaleString("pt-BR")}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4">Nenhum evento registrado ainda.</p>
              )}
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Último Webhook Recebido (Checkout)</h3>
              {diagData?.webhooks?.lastWebhook ? (
                <div className="p-3 bg-slate-50 dark:bg-[#061224] rounded-lg text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
                  <p><strong>Plataforma:</strong> {diagData.webhooks.lastWebhook.platform}</p>
                  <p><strong>Evento:</strong> {diagData.webhooks.lastWebhook.eventType}</p>
                  <p><strong>Status:</strong> {diagData.webhooks.lastWebhook.status}</p>
                  <p><strong>Data:</strong> {new Date(diagData.webhooks.lastWebhook.receivedAt).toLocaleString("pt-BR")}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4">Nenhum webhook recebido ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Pixel */}
      {isPixelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-[#142C52] space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Adicionar Meta Pixel</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Pixel *</label>
                <input
                  type="text"
                  placeholder="Ex: Pixel Principal"
                  value={pixelForm.name}
                  onChange={(e) => setPixelForm({ ...pixelForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pixel ID *</label>
                <input
                  type="text"
                  placeholder="Ex: 123456789012345"
                  value={pixelForm.pixelId}
                  onChange={(e) => setPixelForm({ ...pixelForm, pixelId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Access Token (Conversions API)</label>
                <input
                  type="password"
                  placeholder="EAAB..."
                  value={pixelForm.accessToken}
                  onChange={(e) => setPixelForm({ ...pixelForm, accessToken: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Armazenado com AES-256 no servidor e nunca exposto.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Código de Evento de Teste (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: TEST12345"
                  value={pixelForm.testEventCode}
                  onChange={(e) => setPixelForm({ ...pixelForm, testEventCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ambiente</label>
                <select
                  value={pixelForm.environment}
                  onChange={(e) => setPixelForm({ ...pixelForm, environment: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs"
                >
                  <option value="production">Produção</option>
                  <option value="test">Teste</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={() => setIsPixelModalOpen(false)}
                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-[#142C52] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePixel}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow"
              >
                Salvar Pixel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

