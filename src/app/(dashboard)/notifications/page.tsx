"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Play, 
  Settings2,
  Sparkles,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { UtmTrackSymbol } from "@/components/brand/symbol";
import { playNotificationSound, isSoundEnabled, setSoundEnabled, isVibrationEnabled, setVibrationEnabled, SoundType } from "@/lib/sound";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  amount?: number;
  currency?: string;
  platform?: string;
  product?: string;
  sound?: string;
  saleId?: string;
  orderId?: string;
  createdAt: string;
};

type Preferences = {
  salesApproved: boolean;
  salesPending: boolean;
  pixGenerated: boolean;
  refunds: boolean;
  chargebacks: boolean;
  systemAlerts: boolean;
  integrationErrors: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "sales" | "alerts">("all");
  const [showConfig, setShowConfig] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  
  const queryClient = useQueryClient();
  const lastKnownCountRef = useRef<number>(0);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    setVibrationOn(isVibrationEnabled());
  }, []);

  const { data, isLoading } = useQuery<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Erro ao buscar notificações");
      return res.json();
    },
    refetchInterval: 6000,
  });

  const { data: prefData } = useQuery<{ preferences: Preferences }>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Erro ao buscar preferências");
      return res.json();
    },
  });

  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    if (prefData?.preferences) {
      setPreferences(prefData.preferences);
    }
  }, [prefData]);

  const updatePrefMutation = useMutation({
    mutationFn: async (newPrefs: Partial<Preferences>) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.preferences) setPreferences(data.preferences);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  useEffect(() => {
    if (!data) return;
    if (lastKnownCountRef.current > 0 && data.notifications.length > lastKnownCountRef.current) {
      const newest = data.notifications[0];
      if (newest && !newest.isRead && newest.sound) {
        playNotificationSound(newest.sound as SoundType);
      }
    }
    lastKnownCountRef.current = data.notifications.length;
  }, [data]);

  const markReadMutation = useMutation({
    mutationFn: async ({ id, all }: { id?: string; all?: boolean }) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, all }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id?: string) => {
      const url = id ? `/api/notifications?id=${id}` : "/api/notifications";
      await fetch(url, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleTestNotification = async (type: string, sound: SoundType) => {
    setTestingType(type);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: 151.04 }),
      });
      const data = await res.json();
      if (data.success) {
        await playNotificationSound(sound);
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    } catch (err) {
      console.error("Erro ao testar notificação:", err);
    } finally {
      setTestingType(null);
    }
  };

  const toggleSound = (val: boolean) => {
    setSoundOn(val);
    setSoundEnabled(val);
    if (preferences) {
      updatePrefMutation.mutate({ soundEnabled: val });
    }
  };

  const toggleVibration = (val: boolean) => {
    setVibrationOn(val);
    setVibrationEnabled(val);
    if (preferences) {
      updatePrefMutation.mutate({ vibrationEnabled: val });
    }
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "sales") {
      return (
        n.type === "sale" ||
        n.type === "sale_approved" ||
        n.type === "pix_pending" ||
        n.type === "sale_pending" ||
        n.type === "refund" ||
        n.type === "chargeback"
      );
    }
    if (filter === "alerts") return n.severity === "error" || n.severity === "warning";
    return true;
  });

  const getSeverityIcon = (sev: string, type: string) => {
    if (type === "sale_approved") return <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />;
    switch (sev.toLowerCase()) {
      case "error":
        return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-sky-500 shrink-0" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <UtmTrackSymbol size={28} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Notificações</h1>
            {unreadCount > 0 && (
              <span className="bg-sky-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                {unreadCount} novas
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Feed oficial de vendas em tempo real, Pix, reembolsos e alertas do sistema com áudio dedicado
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/notifications"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0066FF]/10 text-[#0066FF] border border-[#0066FF]/30 rounded-lg hover:bg-[#0066FF]/20 transition"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Personalizar Sons
          </Link>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Settings2 className="w-4 h-4 text-sky-500" />
            Preferências
          </button>
          {notifications.length > 0 && (
            <>
              <button
                onClick={() => markReadMutation.mutate({ all: true })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
                Marcar lidas
              </button>
              <button
                onClick={() => {
                  if (confirm("Limpar todo o histórico de notificações?")) deleteMutation.mutate();
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Limpar tudo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Play className="w-4 h-4 text-sky-400" /> Teste de Notificações &amp; Sons Oficiais
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simule o disparo de notificações e verifique a resposta sonora proprietária do UTM-Track
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleSound(!soundOn)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                soundOn
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {soundOn ? "Sons Ativados" : "Mudo"}
            </button>
            <button
              onClick={() => toggleVibration(!vibrationOn)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                vibrationOn
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              {vibrationOn ? "Vibração On" : "Vibração Off"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <button
            disabled={testingType !== null}
            onClick={() => handleTestNotification("sale_approved", "som_venda_aprovada")}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-emerald-950/40 border border-slate-700 hover:border-emerald-500/50 transition-all text-center group"
          >
            <span className="text-xs font-semibold text-emerald-400 group-hover:scale-105 transition-transform">
              💰 Venda Aprovada
            </span>
            <span className="text-[10px] text-slate-400 mt-1">som_venda_aprovada</span>
          </button>

          <button
            disabled={testingType !== null}
            onClick={() => handleTestNotification("pix_pending", "som_pix_gerado")}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-sky-950/40 border border-slate-700 hover:border-sky-500/50 transition-all text-center group"
          >
            <span className="text-xs font-semibold text-sky-400 group-hover:scale-105 transition-transform">
              ⚡ Pix Gerado
            </span>
            <span className="text-[10px] text-slate-400 mt-1">som_pix_gerado</span>
          </button>

          <button
            disabled={testingType !== null}
            onClick={() => handleTestNotification("sale_pending", "som_pix_gerado")}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-amber-950/40 border border-slate-700 hover:border-amber-500/50 transition-all text-center group"
          >
            <span className="text-xs font-semibold text-amber-400 group-hover:scale-105 transition-transform">
              ⏳ Venda Pendente
            </span>
            <span className="text-[10px] text-slate-400 mt-1">som_pix_gerado</span>
          </button>

          <button
            disabled={testingType !== null}
            onClick={() => handleTestNotification("refund", "som_reembolso")}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-orange-950/40 border border-slate-700 hover:border-orange-500/50 transition-all text-center group"
          >
            <span className="text-xs font-semibold text-orange-400 group-hover:scale-105 transition-transform">
              ↩️ Reembolso
            </span>
            <span className="text-[10px] text-slate-400 mt-1">som_reembolso</span>
          </button>

          <button
            disabled={testingType !== null}
            onClick={() => handleTestNotification("chargeback", "som_chargeback")}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-red-950/40 border border-slate-700 hover:border-red-500/50 transition-all text-center group"
          >
            <span className="text-xs font-semibold text-red-400 group-hover:scale-105 transition-transform">
              🚨 Chargeback
            </span>
            <span className="text-[10px] text-slate-400 mt-1">som_chargeback</span>
          </button>
        </div>
      </div>

      {showConfig && preferences && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-sky-500" /> Preferências de Notificação por Tipo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.salesApproved}
                onChange={(e) => updatePrefMutation.mutate({ salesApproved: e.target.checked })}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Vendas aprovadas</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.salesPending}
                onChange={(e) => updatePrefMutation.mutate({ salesPending: e.target.checked })}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Vendas pendentes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.pixGenerated}
                onChange={(e) => updatePrefMutation.mutate({ pixGenerated: e.target.checked })}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Pix gerado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.refunds}
                onChange={(e) => updatePrefMutation.mutate({ refunds: e.target.checked })}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Reembolsos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.chargebacks}
                onChange={(e) => updatePrefMutation.mutate({ chargebacks: e.target.checked })}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Chargebacks</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.systemAlerts}
                onChange={(e) => updatePrefMutation.mutate({ systemAlerts: e.target.checked })}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>Alertas do sistema</span>
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 text-sm">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
            filter === "all" ? "bg-sky-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Todas ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
            filter === "unread" ? "bg-sky-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Não Lidas ({unreadCount})
        </button>
        <button
          onClick={() => setFilter("sales")}
          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
            filter === "sales" ? "bg-sky-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Vendas &amp; Pix
        </button>
        <button
          onClick={() => setFilter("alerts")}
          className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
            filter === "alerts" ? "bg-sky-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Alertas Críticos
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="font-medium">Nenhuma notificação encontrada</p>
            <p className="text-xs mt-1">Quando houver novos eventos, alertas ou vendas, eles aparecerão aqui com notificação sonora.</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                notif.isRead
                  ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-90"
                  : "bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/60 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1">
                {getSeverityIcon(notif.severity, notif.type)}
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {notif.title}
                    </h3>
                    {notif.amount !== undefined && notif.amount !== null && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        {formatCurrency(notif.amount, notif.currency || "BRL")}
                      </span>
                    )}
                    {notif.platform && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {notif.platform}
                      </span>
                    )}
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1">
                    <span>{formatDateTime(notif.createdAt)}</span>
                    {notif.sound && (
                      <button
                        onClick={() => playNotificationSound(notif.sound as SoundType)}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        <Volume2 className="w-3 h-3" /> Tocar som
                      </button>
                    )}
                    {notif.saleId && (
                      <Link
                        href={`/sales/${notif.saleId}`}
                        className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" /> Detalhes da Venda
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!notif.isRead && (
                  <button
                    onClick={() => markReadMutation.mutate({ id: notif.id })}
                    className="p-1.5 text-gray-400 hover:text-sky-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Marcar como lida"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(notif.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Excluir notificação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
