"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ArrowRight,
  Download,
  Bell,
  Volume2,
  ShieldCheck,
  Layers,
  Sparkles,
  QrCode
} from "lucide-react";
import { UtmTrackSymbol } from "@/components/brand/symbol";
import { playNotificationSound, SoundType } from "@/lib/sound";

export default function AppStatusPage() {
  const [activeTab, setActiveTab] = useState<"mobile" | "services">("mobile");

  const { data: accountsData, isLoading: loadingAccounts, refetch } = useQuery({
    queryKey: ["meta-accounts"],
    queryFn: () => fetch("/api/meta/accounts").then((r) => r.json()),
  });

  const { data: pixelsData, isLoading: loadingPixels } = useQuery({
    queryKey: ["pixels"],
    queryFn: () => fetch("/api/pixels").then((r) => r.json()),
  });

  const { data: devicesData } = useQuery<{ devices: any[] }>({
    queryKey: ["registered-devices"],
    queryFn: () => fetch("/api/devices").then((r) => r.json()),
    refetchInterval: 8000,
  });

  const accounts = accountsData?.accounts || [];
  const pixels = pixelsData?.pixels || [];
  const devices = devicesData?.devices || [];

  const apps = [
    {
      name: "Meta Ads (Graph API v21.0)",
      description: "Sincronização de campanhas, conjuntos, anúncios e métricas de anúncios.",
      status: accounts.length > 0 ? "healthy" : "disconnected",
      statusText: accounts.length > 0 ? `${accounts.length} Conta(s) Conectada(s)` : "Desconectado",
      href: "/meta-ads",
    },
    {
      name: "Meta Conversions API (CAPI)",
      description: "Disparo server-side de conversões com deduplicação e hash SHA-256.",
      status: pixels.length > 0 ? "healthy" : "disconnected",
      statusText: pixels.length > 0 ? `${pixels.length} Pixel(s) Ativo(s)` : "Não configurado",
      href: "/integrations/pixel",
    },
    {
      name: "Tracker.js (Script Client-Side)",
      description: "Script de rastreamento de visitantes, UTMs, fbclid, _fbp e _fbc.",
      status: "healthy",
      statusText: "Pronto para Instalação",
      href: "/integrations/tracker",
    },
    {
      name: "Webhook Hotmart",
      description: "Recepção de compras aprovadas, cancelamentos e reembolsos com token hottok.",
      status: "healthy",
      statusText: "Endpoint Operacional",
      href: "/integrations",
    },
    {
      name: "Webhook Shopify",
      description: "Recepção de pedidos e reembolsos com autenticação criptográfica HMAC-SHA256.",
      status: "healthy",
      statusText: "Endpoint Operacional",
      href: "/integrations",
    },
    {
      name: "Webhooks Yampi & Cacto",
      description: "Captura de checkout e metadados de vendas com idempotência ativa.",
      status: "healthy",
      statusText: "Endpoint Operacional",
      href: "/integrations",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <UtmTrackSymbol size={32} />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Aplicativo &amp; Ecossistema
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Status dos aplicativos nativos Android/iOS, push notifications e saúde das integrações
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab("mobile")}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === "mobile" ? "bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm" : "text-gray-500"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> App Mobile
            </button>
            <button
              onClick={() => setActiveTab("services")}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === "services" ? "bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-400 shadow-sm" : "text-gray-500"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Serviços Web &amp; APIs
            </button>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {activeTab === "mobile" ? (
        <div className="space-y-6">
          {/* Mobile Overview Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 border border-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <UtmTrackSymbol size={200} />
            </div>

            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> App Oficial UTM-Track Android &amp; iOS
              </div>

              <h2 className="text-2xl font-bold tracking-tight">
                Vendas e Atribuição em Tempo Real no seu Celular
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed">
                Aplicativo nativo com alertas sonoros instantâneos de <strong className="text-white">venda aprovada</strong>, 
                notificação de <strong className="text-white">Pix gerado</strong>, controle de faturamento, ROAS e acompanhamento de campanhas direto no bolso.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Pacote Nativo</div>
                  <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">com.utmtrack.app</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Push Notifications</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">Ativo (FCM / APNs)</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Dispositivos</div>
                  <div className="text-xs font-bold text-white mt-0.5">{devices.length} conectado(s)</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[11px] text-slate-400">Identidade Sonora</div>
                  <div className="text-xs font-bold text-sky-400 mt-0.5">4 Sons Exclusivos</div>
                </div>
              </div>
            </div>
          </div>

          {/* Device and Sounds Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dispositivos Registrados */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-sky-600" /> Dispositivos Conectados
                </h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                  {devices.length} ativo(s)
                </span>
              </div>

              {devices.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-500">
                  <Smartphone className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs font-medium">Nenhum dispositivo registrado ainda</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Ao abrir o app no Android ou iOS, seu token de push será vinculado automaticamente ao workspace.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((d: any) => (
                    <div
                      key={d.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {d.deviceName || `${d.platform.toUpperCase()} Device`}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {d.token.slice(0, 16)}...{d.token.slice(-8)}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {d.platform}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sons e Notificações */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-sky-600" /> Sons Nativos das Notificações
                </h3>
                <Link
                  href="/notifications"
                  className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline flex items-center gap-1"
                >
                  Central de Notificações <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                  <div>
                    <div className="font-bold text-emerald-900 dark:text-emerald-300">Venda Aprovada (Cha-ching)</div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400">som_venda_aprovada.wav</div>
                  </div>
                  <button
                    onClick={() => playNotificationSound("som_venda_aprovada")}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
                  >
                    Ouvir
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40">
                  <div>
                    <div className="font-bold text-sky-900 dark:text-sky-300">Pix Gerado (Chime Pendente)</div>
                    <div className="text-[10px] text-sky-700 dark:text-sky-400">som_pix_gerado.wav</div>
                  </div>
                  <button
                    onClick={() => playNotificationSound("som_pix_gerado")}
                    className="px-2.5 py-1 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition"
                  >
                    Ouvir
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40">
                  <div>
                    <div className="font-bold text-indigo-900 dark:text-indigo-300">Venda Pendente (Boleto/Espera)</div>
                    <div className="text-[10px] text-indigo-700 dark:text-indigo-400">som_venda_pendente.wav</div>
                  </div>
                  <button
                    onClick={() => playNotificationSound("som_venda_pendente")}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
                  >
                    Ouvir
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                  <div>
                    <div className="font-bold text-amber-900 dark:text-amber-300">Reembolso / Alerta</div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400">som_reembolso.wav</div>
                  </div>
                  <button
                    onClick={() => playNotificationSound("som_reembolso")}
                    className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition"
                  >
                    Ouvir
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
                  <div>
                    <div className="font-bold text-red-900 dark:text-red-300">Chargeback Crítico</div>
                    <div className="text-[10px] text-red-700 dark:text-red-400">som_chargeback.wav</div>
                  </div>
                  <button
                    onClick={() => playNotificationSound("som_chargeback")}
                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    Ouvir
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Official App Assets & Icons */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UtmTrackSymbol size={20} /> Ícones & Identidade Visual do App
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                Android & iOS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/50 flex items-center gap-3">
                <img src="/brand/app/icon-192.png" alt="App Icon" className="w-14 h-14 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700" />
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-xs">Ícone do App (Launcher)</div>
                  <div className="text-[10px] text-gray-500">Android & iOS 1024x1024</div>
                  <a href="/brand/app/app-icon-1024.png" target="_blank" rel="noreferrer" className="text-[11px] text-sky-600 dark:text-sky-400 font-medium hover:underline">
                    Baixar HD
                  </a>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/50 flex items-center gap-3">
                <img src="/brand/notifications/notification-badge-96.png" alt="Notification Icon" className="w-14 h-14 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 bg-[#081A33] p-2 object-contain" />
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-xs">Ícone de Notificação Push</div>
                  <div className="text-[10px] text-gray-500">FCM / APNs Status Bar</div>
                  <a href="/brand/notifications/notification-icon.png" target="_blank" rel="noreferrer" className="text-[11px] text-sky-600 dark:text-sky-400 font-medium hover:underline">
                    Baixar HD
                  </a>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/50 flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#081A33] border border-gray-200 dark:border-gray-700 p-1 flex items-center justify-center">
                  <UtmTrackSymbol size={40} />
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-xs">Símbolo Vetorial (SVG)</div>
                  <div className="text-[10px] text-gray-500">Escalabilidade infinita</div>
                  <a href="/brand/icons/symbol.svg" target="_blank" rel="noreferrer" className="text-[11px] text-sky-600 dark:text-sky-400 font-medium hover:underline">
                    Ver SVG
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Services Ecosystem */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => {
            const isHealthy = app.status === "healthy";
            return (
              <div
                key={app.name}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isHealthy
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                      }`}
                    >
                      {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {app.statusText}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-base">{app.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{app.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Saúde: Operacional</span>
                  <Link
                    href={app.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Gerenciar <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
