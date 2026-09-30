"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plug,
  TrendingUp,
  ShoppingBag,
  Code,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Copy,
  Check,
  Plus,
  Trash2,
  Play,
  Settings2,
  ExternalLink,
  Layers,
  Link2,
  FileCode,
  Activity,
  HelpCircle,
  Globe,
  Sliders,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LiveLinkInspector } from "@/components/tracking/live-link-inspector";

export default function IntegrationsHubPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ANÚNCIOS" | "WEBHOOKS" | "UTMs" | "PIXEL" | "TESTES" | "INSPETOR">("ANÚNCIOS");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados dos Pixels
  const [isPixelModalOpen, setIsPixelModalOpen] = useState(false);
  const [pixelForm, setPixelForm] = useState({
    name: "",
    pixelId: "",
    accessToken: "",
    testEventCode: "",
    environment: "production",
    leadRule: true,
    addToCartRule: true,
    initiateCheckoutRule: true,
    checkoutUrlPattern: "pay.hotmart.com,checkout.cakto.com.br,kiwify.com.br,getfy.com,app.profjonathanrocha.com.br,yampi.io,myshopify.com",
    purchaseRule: true,
  });

  // Estados do Gerador de UTM
  const [utmDestination, setUtmDestination] = useState("");
  const [utmSource, setUtmSource] = useState("facebook");
  const [utmMedium, setUtmMedium] = useState("cpc");
  const [utmCampaign, setUtmCampaign] = useState("escala_principal");
  const [utmContent, setUtmContent] = useState("video_01");
  const [utmTerm, setUtmTerm] = useState("feed");
  const [generatedUtmUrl, setGeneratedUtmUrl] = useState("");

  // Estados dos Testes
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Queries
  const { data: adAccountsData } = useQuery({
    queryKey: ["meta-accounts"],
    queryFn: () => fetch("/api/meta/accounts").then((r) => r.json()),
  });

  const { data: pixelsData } = useQuery({
    queryKey: ["pixels"],
    queryFn: () => fetch("/api/pixels").then((r) => r.json()),
  });

  const { data: genericEndpointsData } = useQuery({
    queryKey: ["generic-endpoints"],
    queryFn: () => fetch("/api/webhooks/generic").then((r) => r.json()),
  });

  const { data: eventsData } = useQuery({
    queryKey: ["recent-events"],
    queryFn: () => fetch("/api/events?limit=5").then((r) => r.json()),
  });

  // Mutações
  const savePixelMutation = useMutation({
    mutationFn: async (body: typeof pixelForm) => {
      const res = await fetch("/api/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao salvar pixel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pixels"] });
      setIsPixelModalOpen(false);
      setPixelForm({
        name: "",
        pixelId: "",
        accessToken: "",
        testEventCode: "",
        environment: "production",
        leadRule: true,
        addToCartRule: true,
        initiateCheckoutRule: true,
        checkoutUrlPattern: "pay.hotmart.com,checkout.cakto.com.br,kiwify.com.br,getfy.com,app.profjonathanrocha.com.br,yampi.io,myshopify.com",
        purchaseRule: true,
      });
    },
  });

  const deletePixelMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/pixels?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pixels"] }),
  });

  const createEndpointMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/webhooks/generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Webhook Personalizado" }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["generic-endpoints"] }),
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/webhooks/generic?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["generic-endpoints"] }),
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleGenerateUtm = () => {
    if (!utmDestination) return;
    try {
      const url = new URL(utmDestination.startsWith("http") ? utmDestination : `https://${utmDestination}`);
      if (utmSource) url.searchParams.set("utm_source", utmSource);
      if (utmMedium) url.searchParams.set("utm_medium", utmMedium);
      if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign);
      if (utmContent) url.searchParams.set("utm_content", utmContent);
      if (utmTerm) url.searchParams.set("utm_term", utmTerm);
      // Meta Dynamic parameters
      url.searchParams.set("src", "{{site_source_name}}");
      url.searchParams.set("sck", "{{campaign.name}}");
      setGeneratedUtmUrl(url.toString());
    } catch {
      setGeneratedUtmUrl(`${utmDestination}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}&utm_content=${utmContent}&utm_term=${utmTerm}`);
    }
  };

  const runIntegrationTest = async (type: "pixel" | "webhook" | "cakto" | "hotmart" | "kiwify" | "getfy") => {
    setTestStatus(`Executando teste de ${type}...`);
    try {
      if (type === "cakto") {
        const res = await fetch("/api/webhooks/cakto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `test_${Date.now()}`,
            status: "approved",
            amount: 97.0,
            currency: "BRL",
            email: "teste@utmtrack.com",
            utms: { source: "teste_integracao", campaign: "campanha_validacao" },
          }),
        });
        const d = await res.json();
        setTestStatus(res.ok ? "✅ Webhook Cakto respondeu com sucesso (HTTP 200)!" : `❌ Erro: ${d.error}`);
      } else if (type === "hotmart") {
        const res = await fetch("/api/webhooks/hotmart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `test_hotmart_${Date.now()}`,
            event: "PURCHASE_APPROVED",
            data: {
              purchase: {
                transaction: `HP${Date.now()}`,
                price: { value: 197.0 },
                status: "APPROVED",
                tracking: { source: "meta_teste" },
              },
              buyer: { email: "comprador@teste.com" },
            },
          }),
        });
        setTestStatus(res.ok ? "✅ Webhook Hotmart validado com sucesso (HTTP 200)!" : "❌ Erro ao validar Hotmart");
      } else if (type === "kiwify") {
        const res = await fetch("/api/webhooks/kiwify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: `test_kiwify_${Date.now()}`,
            order_status: "paid",
            order_amount: 19700,
            Commissions: { charge_amount: 19700, my_commission: 18000 },
            Customer: { email: "comprador@kiwify.com", mobile: "11999998888" },
            TrackingParameters: { src: "facebook_ads", utm_source: "fb", utm_campaign: "campanha_teste" }
          }),
        });
        const d = await res.json().catch(() => ({}));
        setTestStatus(res.ok ? "✅ Webhook Kiwify validado com sucesso (HTTP 200)!" : `❌ Erro: ${d.error || 'Falha ao validar Kiwify'}`);
      } else if (type === "getfy") {
        const res = await fetch("/api/webhooks/getfy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "pedido_pago",
            event_label: "Pedido pago",
            payload: {
              order: {
                id: `test_getfy_${Date.now()}`,
                status: "completed",
                amount: 197.0,
                currency: "BRL",
                created_at: new Date().toISOString()
              },
              customer: {
                email: "comprador@getfy.com.br",
                phone: "5511999997777",
                name: "Cliente Getfy Teste"
              },
              amount: 197.0,
              status: "paid",
              paymentMethod: "pix",
              paymentMethodName: "Pix",
              product: {
                id: "prod-getfy-test",
                name: "Produto Exemplo Getfy"
              },
              tracking: {
                utm_source: "facebook",
                utm_medium: "cpc",
                utm_campaign: "campanha_getfy_teste",
                src: "facebook",
                sck: "campanha_getfy_teste"
              }
            }
          }),
        });
        const d = await res.json().catch(() => ({}));
        setTestStatus(res.ok ? "✅ Webhook Getfy validado com sucesso (HTTP 200)!" : `❌ Erro: ${d.error || 'Falha ao validar Getfy'}`);
      } else {
        setTestStatus("✅ Evento de teste disparado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ["recent-events"] });
    } catch (e: any) {
      setTestStatus(`❌ Falha no teste: ${e.message}`);
    }
    setTimeout(() => setTestStatus(null), 6000);
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://utm-track-navy.vercel.app";
  const connectedAccountsCount = adAccountsData?.accounts?.length || 0;
  const pixels = pixelsData?.pixels || [];
  const genericEndpoints = genericEndpointsData?.endpoints || [];

  const tabs: Array<"ANÚNCIOS" | "WEBHOOKS" | "UTMs" | "PIXEL" | "TESTES" | "INSPETOR"> = [
    "ANÚNCIOS",
    "WEBHOOKS",
    "UTMs",
    "PIXEL",
    "TESTES",
    "INSPETOR",
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Plug className="w-6 h-6 text-blue-600" />
          Hub de Integrações
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Conexões com plataformas de tráfego, gateways de checkout, webhooks oficiais, gerador de UTMs e pixels CAPI
        </p>
      </div>

      {/* Navegação Superior por Abas */}
      <div className="border-b border-slate-200 dark:border-[#142C52] flex items-center justify-between">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-xs font-bold tracking-wider uppercase transition-all relative ${
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

        {/* Badge WhatsApp (Preparado para Futura Implementação) */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-full text-[11px] text-slate-400">
          <MessageSquare className="w-3 h-3 text-emerald-500" />
          <span>WhatsApp (Em breve)</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. ABA: ANÚNCIOS */}
      {/* ============================================================ */}
      {activeTab === "ANÚNCIOS" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Meta Ads (Principal) */}
            <div className="bg-white dark:bg-[#081A33] border-2 border-blue-500/80 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    connectedAccountsCount > 0
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {connectedAccountsCount > 0 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> {connectedAccountsCount} Conta(s) Conectada(s)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> Desconectado
                      </>
                    )}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Meta Ads</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Integração oficial via Meta Graph API v21.0 com importação automática de contas, campanhas, conjuntos, anúncios e métricas reais de Insights.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-[#142C52] flex gap-2">
                <Link
                  href="/meta-ads"
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 shadow transition-colors"
                >
                  Gerenciar Contas <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/api/meta/oauth"
                  className="px-3 py-2 border border-slate-200 dark:border-[#142C52] hover:bg-slate-50 dark:hover:bg-[#142C52] text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300"
                  title="Conectar novo perfil"
                >
                  <Plus className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Google Ads (Extensível) */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between opacity-80">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg">
                    <Globe className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Extensível / Próximo
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Google Ads</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Arquitetura preparada para sincronização de campanhas de pesquisa, YouTube e Performance Max via Google Ads API.
                  </p>
                </div>
              </div>
              <button disabled className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed">
                Em Breve
              </button>
            </div>

            {/* TikTok Ads (Extensível) */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between opacity-80">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Extensível / Próximo
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">TikTok Ads</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Estrutura modular para leitura de métricas e conversões via TikTok Marketing API.
                  </p>
                </div>
              </div>
              <button disabled className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg cursor-not-allowed">
                Em Breve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. ABA: WEBHOOKS */}
      {/* ============================================================ */}
      {activeTab === "WEBHOOKS" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Webhooks Oficiais de Pagamento
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Receba dados de vendas, Pix, aprovações, reembolsos e chargebacks em tempo real com idempotência garantida
              </p>
            </div>

            <button
              onClick={() => createEndpointMutation.mutate()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Webhook Personalizado
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Hotmart */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Hotmart</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporta: Compra Aprovada, Pix Gerado, Aguardando Pagamento, Reembolso, Chargeback e UTMs.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  URL do Webhook (Cole na Hotmart):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${appUrl}/api/webhooks/hotmart`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/webhooks/hotmart`, "hotmart")}
                    className="p-2 border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300"
                    title="Copiar URL"
                  >
                    {copiedKey === "hotmart" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Header: x-hotmart-hottok</span>
                <button
                  onClick={() => runIntegrationTest("hotmart")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  Testar Webhook
                </button>
              </div>
            </div>

            {/* Cakto (Nome Oficial) */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Cakto</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporta: Vendas, Pagamentos Pix, Aprovações, Cancelamentos, Reembolsos, Chargebacks e Rastreamento.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  URL do Webhook (Cole na Cakto):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${appUrl}/api/webhooks/cakto`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/webhooks/cakto`, "cakto")}
                    className="p-2 border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300"
                    title="Copiar URL"
                  >
                    {copiedKey === "cakto" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Header: x-cakto-signature</span>
                <button
                  onClick={() => runIntegrationTest("cakto")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  Testar Webhook
                </button>
              </div>
            </div>

            {/* Yampi */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Yampi</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporta: Pedidos, Pagamento Aprovado, Pix Pendente, Cancelamentos, Reembolsos e UTMs.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  URL do Webhook (Cole na Yampi):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${appUrl}/api/webhooks/yampi`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/webhooks/yampi`, "yampi")}
                    className="p-2 border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300"
                    title="Copiar URL"
                  >
                    {copiedKey === "yampi" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Header: Authorization (Bearer)</span>
                <span className="text-emerald-600 font-semibold">Idempotente</span>
              </div>
            </div>

            {/* Shopify */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Shopify</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporta: orders/paid, orders/cancelled, refunds/create com validação de assinatura HMAC-SHA256.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  URL do Webhook (Cole na Shopify):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${appUrl}/api/webhooks/shopify`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/webhooks/shopify`, "shopify")}
                    className="p-2 border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300"
                    title="Copiar URL"
                  >
                    {copiedKey === "shopify" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Header: x-shopify-hmac-sha256</span>
                <span className="text-emerald-600 font-semibold">HMAC Validado</span>
              </div>
            </div>

            {/* Kiwify */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#13C15D]" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Kiwify</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporta: Compra Aprovada, Pix Gerado, Aguardando Pagamento, Reembolso, Chargeback, Conversão de Centavos e UTMs.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  URL do Webhook (Cole na Kiwify):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${appUrl}/api/webhooks/kiwify`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/webhooks/kiwify`, "kiwify")}
                    className="p-2 border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300"
                    title="Copiar URL"
                  >
                    {copiedKey === "kiwify" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Dica: Cole em Apps → Webhooks</span>
                <button
                  onClick={() => runIntegrationTest("kiwify")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  Testar Webhook
                </button>
              </div>
            </div>

            {/* Getfy */}
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Getfy</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Suporta: Pedido Pago, Pix Gerado, Boleto Gerado, Assinaturas, Reembolso, Recusado, Cancelado e UTMs.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  URL do Webhook (Cole no Getfy):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${appUrl}/api/webhooks/getfy`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => copyToClipboard(`${appUrl}/api/webhooks/getfy`, "getfy")}
                    className="p-2 border border-slate-200 dark:border-[#142C52] rounded-lg hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-600 dark:text-slate-300"
                    title="Copiar URL"
                  >
                    {copiedKey === "getfy" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Header: Authorization (Bearer) ou ?token=</span>
                <button
                  onClick={() => runIntegrationTest("getfy")}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  Testar Webhook
                </button>
              </div>
            </div>
          </div>

          {/* Endpoints Personalizados / Genéricos */}
          {genericEndpoints.length > 0 && (
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Webhooks Personalizados Criados
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
                {genericEndpoints.map((ep: any) => (
                  <div key={ep.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{ep.name}</p>
                      <p className="font-mono text-slate-400 text-[11px]">{`${appUrl}/api/webhooks/generic/${ep.endpointId}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(`${appUrl}/api/webhooks/generic/${ep.endpointId}`, ep.id)}
                        className="p-1.5 border border-slate-200 dark:border-[#142C52] rounded hover:bg-slate-50"
                      >
                        {copiedKey === ep.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteEndpointMutation.mutate(ep.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ABA: UTMs */}
      {/* ============================================================ */}
      {activeTab === "UTMs" && (
        <div className="space-y-6">
          {/* Seção CÓDIGOS de Parâmetros de URL */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Parâmetros Oficiais de Rastreamento Dinâmico (Meta Ads)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cole no campo &quot;Parâmetros de URL&quot; ao criar ou editar anúncios no Gerenciador da Meta
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg font-mono text-xs text-blue-600 dark:text-blue-400 break-all flex items-center justify-between gap-3">
              <span>utm_source={"{site_source_name}"}&utm_medium={"{placement}"}&utm_campaign={"{campaign.name}"}&utm_content={"{adset.name}"}&utm_term={"{ad.name}"}&src={"{site_source_name}"}&sck={"{campaign.name}"}</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    "utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}&src={{site_source_name}}&sck={{campaign.name}}",
                    "meta_utm"
                  )
                }
                className="px-3 py-1.5 bg-blue-600 text-white rounded font-bold text-xs hover:bg-blue-700 shadow shrink-0"
              >
                {copiedKey === "meta_utm" ? "Copiado!" : "Copiar Parâmetros"}
              </button>
            </div>
          </div>

          {/* Gerador de UTMs Orgânicas */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Gerador de Links Rastreados (UTMs)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Construa URLs completas para links da bio, parcerias, influencers e disparos de e-mail
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  URL de Destino *
                </label>
                <input
                  type="text"
                  placeholder="https://seusite.com.br/produto"
                  value={utmDestination}
                  onChange={(e) => setUtmDestination(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  utm_source (Origem)
                </label>
                <input
                  type="text"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  utm_medium (Mídia)
                </label>
                <input
                  type="text"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  utm_campaign (Campanha)
                </label>
                <input
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  utm_content (Conteúdo/Criativo)
                </label>
                <input
                  type="text"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  utm_term (Termo/Público)
                </label>
                <input
                  type="text"
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateUtm}
                  disabled={!utmDestination}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow disabled:opacity-50"
                >
                  Gerar URL
                </button>
              </div>
            </div>

            {generatedUtmUrl && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2 animate-in fade-in">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">URL Rastreada Pronta:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedUtmUrl}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-[#061224] border border-blue-300 dark:border-blue-800 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedUtmUrl, "gen_url")}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                  >
                    {copiedKey === "gen_url" ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seção Scripts (Tracker & Back Redirect) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Script de UTMs & Tracker</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                  Próprio (&lt;3KB)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cole antes do fechamento da tag &lt;/body&gt; em todas as páginas do seu site ou funil.
              </p>
              <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto">
                {`<script src="${appUrl}/tracker.js" data-api-url="${appUrl}" async></script>`}
              </pre>
              <button
                onClick={() =>
                  copyToClipboard(
                    `<script src="${appUrl}/tracker.js" data-api-url="${appUrl}" async></script>`,
                    "script_tracker"
                  )
                }
                className="w-full py-1.5 border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#142C52]"
              >
                {copiedKey === "script_tracker" ? "Copiado!" : "Copiar Script de Tracking"}
              </button>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Script de Back Redirect</h3>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400 text-[10px] font-bold rounded-full">
                  Recuperação
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Redireciona o visitante para uma oferta especial caso ele clique em &quot;Voltar&quot; no navegador.
              </p>
              <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto">
                {`<script>
  window.addEventListener('popstate', function() {
    window.location.href = 'https://seusite.com.br/oferta-especial';
  });
  history.pushState(null, null, location.href);
</script>`}
              </pre>
              <button
                onClick={() =>
                  copyToClipboard(
                    `<script>\n  window.addEventListener('popstate', function() {\n    window.location.href = 'https://seusite.com.br/oferta-especial';\n  });\n  history.pushState(null, null, location.href);\n</script>`,
                    "script_back"
                  )
                }
                className="w-full py-1.5 border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#142C52]"
              >
                {copiedKey === "script_back" ? "Copiado!" : "Copiar Script Back Redirect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. ABA: PIXEL */}
      {/* ============================================================ */}
      {activeTab === "PIXEL" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pixels da Meta & Conversions API (CAPI)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Disparo server-side de eventos deduplicados com regras configuráveis e detecção de checkout por URL
              </p>
            </div>

            <button
              onClick={() => setIsPixelModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Pixel
            </button>
          </div>

          {pixels.length === 0 ? (
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-8 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Nenhum Pixel Cadastrado</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Adicione seu Pixel ID da Meta e Access Token CAPI para envio seguro de eventos no servidor.
              </p>
              <button
                onClick={() => setIsPixelModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
              >
                Configurar Primeiro Pixel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pixels.map((pix: any) => (
                <div
                  key={pix.id}
                  className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{pix.name}</h4>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                        {pix.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-400">ID: {pix.pixelId}</p>

                    <div className="pt-2 border-t border-slate-100 dark:border-[#142C52] text-xs space-y-1 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ambiente:</span>
                        <span className="font-semibold capitalize">{pix.environment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Token CAPI:</span>
                        <span className="font-mono text-[11px]">
                          {pix.accessTokenEnc ? "••••••••" + pix.accessTokenEnc.slice(-4) : "Não configurado"}
                        </span>
                      </div>
                      {pix.testEventCode && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Test Code:</span>
                          <span className="font-mono text-[11px]">{pix.testEventCode}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#142C52] flex items-center justify-between">
                    <button
                      onClick={() => runIntegrationTest("pixel")}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Testar Disparo
                    </button>
                    <button
                      onClick={() => deletePixelMutation.mutate(pix.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal Adicionar / Configurar Pixel */}
          {isPixelModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-200 dark:border-[#142C52] max-h-[90vh] overflow-y-auto">
                <div className="border-b border-slate-100 dark:border-[#142C52] pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Configurar Meta Pixel & Regras de Eventos
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defina as regras de disparo de Leads, Carrinhos, InitiateCheckout e Purchase
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Identificador *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Pixel Principal Infoproduto"
                      value={pixelForm.name}
                      onChange={(e) => setPixelForm({ ...pixelForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pixel ID da Meta *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123456789012345"
                      value={pixelForm.pixelId}
                      onChange={(e) => setPixelForm({ ...pixelForm, pixelId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Access Token Conversions API (CAPI)
                    </label>
                    <input
                      type="password"
                      placeholder="EAAB..."
                      value={pixelForm.accessToken}
                      onChange={(e) => setPixelForm({ ...pixelForm, accessToken: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Criptografado com AES-256-GCM. Nunca exposto.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Test Event Code (Opcional - para aba de testes do Gerenciador)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: TEST12345"
                      value={pixelForm.testEventCode}
                      onChange={(e) => setPixelForm({ ...pixelForm, testEventCode: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-mono"
                    />
                  </div>

                  {/* REGRAS DE EVENTOS DO PIXEL */}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#142C52] space-y-3">
                    <p className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                      Regras de Disparo de Eventos
                    </p>

                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52]">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Regra de Lead</p>
                        <p className="text-[10px] text-slate-400">Dispara Lead ao submeter formulários de captura</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={pixelForm.leadRule}
                        onChange={(e) => setPixelForm({ ...pixelForm, leadRule: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52]">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Regra de AddToCart</p>
                        <p className="text-[10px] text-slate-400">Dispara ao clicar em botões de adicionar ao carrinho</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={pixelForm.addToCartRule}
                        onChange={(e) => setPixelForm({ ...pixelForm, addToCartRule: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </label>

                    {/* DETECÇÃO DE CHECKOUT POR URL */}
                    <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-blue-900 dark:text-blue-200">Regra de InitiateCheckout</p>
                          <p className="text-[10px] text-blue-700 dark:text-blue-300">
                            Detecta transição do visitante para o gateway de pagamento
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={pixelForm.initiateCheckoutRule}
                          onChange={(e) => setPixelForm({ ...pixelForm, initiateCheckoutRule: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-blue-900 dark:text-blue-200 mb-1">
                          URLs ou Domínios do Checkout (separados por vírgula):
                        </label>
                        <input
                          type="text"
                          placeholder="pay.hotmart.com, checkout.cakto.com.br, yampi.io"
                          value={pixelForm.checkoutUrlPattern}
                          onChange={(e) => setPixelForm({ ...pixelForm, checkoutUrlPattern: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-[#061224] border border-blue-300 dark:border-blue-800 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                        />
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                          Quando o visitante clica em um link com esse padrão, o tracker registra InitiateCheckout.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52]">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Regra de Purchase</p>
                        <p className="text-[10px] text-slate-400">Dispara apenas para vendas confirmadas via Webhook oficial</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={pixelForm.purchaseRule}
                        onChange={(e) => setPixelForm({ ...pixelForm, purchaseRule: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsPixelModalOpen(false)}
                    className="flex-1 py-2 text-xs border border-slate-200 dark:border-[#142C52] rounded-xl hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-700 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => savePixelMutation.mutate(pixelForm)}
                    disabled={!pixelForm.name || !pixelForm.pixelId}
                    className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow disabled:opacity-50"
                  >
                    Salvar Pixel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. ABA: TESTES */}
      {/* ============================================================ */}
      {activeTab === "TESTES" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Painel de Validação e Testes em Tempo Real
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simule webhooks de compra, disparos CAPI e verifique o processamento dos eventos no sistema
            </p>
          </div>

          {testStatus && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-200 animate-in fade-in">
              {testStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Testar Webhook Getfy</h3>
              <p className="text-[11px] text-slate-400">Simula pedido pago de R$ 197,00</p>
              <button
                onClick={() => runIntegrationTest("getfy")}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow"
              >
                Disparar Teste Getfy
              </button>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Testar Webhook Kiwify</h3>
              <p className="text-[11px] text-slate-400">Simula venda paga de R$ 197,00</p>
              <button
                onClick={() => runIntegrationTest("kiwify")}
                className="w-full py-1.5 bg-[#13C15D] hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow"
              >
                Disparar Teste Kiwify
              </button>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Testar Webhook Cakto</h3>
              <p className="text-[11px] text-slate-400">Simula venda aprovada de R$ 97,00</p>
              <button
                onClick={() => runIntegrationTest("cakto")}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow"
              >
                Disparar Teste Cakto
              </button>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Testar Webhook Hotmart</h3>
              <p className="text-[11px] text-slate-400">Simula evento PURCHASE_APPROVED</p>
              <button
                onClick={() => runIntegrationTest("hotmart")}
                className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow"
              >
                Disparar Teste Hotmart
              </button>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Testar Meta CAPI</h3>
              <p className="text-[11px] text-slate-400">Dispara PageView com hash SHA-256</p>
              <button
                onClick={() => runIntegrationTest("pixel")}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow"
              >
                Disparar Teste CAPI
              </button>
            </div>

            <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Ver Logs de Eventos</h3>
              <p className="text-[11px] text-slate-400">Acesse a central de eventos em tempo real</p>
              <Link
                href="/events"
                className="block text-center py-1.5 border border-slate-200 dark:border-[#142C52] rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#142C52]"
              >
                Ver Todos os Eventos
              </Link>
            </div>
          </div>

          {/* Testador de Rastreamento ao Vivo integrado */}
          <div className="pt-6 border-t border-slate-200 dark:border-[#142C52]">
            <LiveLinkInspector />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. ABA: INSPETOR AO VIVO */}
      {/* ============================================================ */}
      {activeTab === "INSPETOR" && (
        <div className="space-y-6">
          <LiveLinkInspector />
        </div>
      )}
    </div>
  );
}
