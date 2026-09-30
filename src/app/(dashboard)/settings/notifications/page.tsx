"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  Check,
  Upload,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Music,
  Info,
  AlertTriangle,
  Radio,
  FileAudio,
} from "lucide-react";
import { UtmTrackSymbol } from "@/components/brand/symbol";
import {
  playNotificationSound,
  stopCurrentSound,
  setSoundEnabled,
  setVibrationEnabled,
  setCustomSoundsEnabled,
  SoundType,
} from "@/lib/sound";

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
  useCustomSounds: boolean;
};

type NotificationSoundRecord = {
  id: string;
  workspaceId: string;
  userId?: string;
  notificationType: string;
  originalFileName: string;
  storagePath: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  duration?: number | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

interface NotificationTypeConfig {
  key: string;
  label: string;
  description: string;
  defaultSoundName: string;
  defaultSoundKey: SoundType;
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderHover: string;
}

const NOTIFICATION_TYPES_CONFIG: NotificationTypeConfig[] = [
  {
    key: "sale_approved",
    label: "VENDA APROVADA",
    description: "Disparado imediatamente quando uma compra tem pagamento confirmado.",
    defaultSoundName: "som_venda_aprovada.wav",
    defaultSoundKey: "som_venda_aprovada",
    icon: "💰",
    badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
    badgeText: "text-emerald-700 dark:text-emerald-400",
    borderHover: "hover:border-emerald-500/50",
  },
  {
    key: "pix_pending",
    label: "PIX GERADO",
    description: "Aviso instantâneo de Pix gerado aguardando liquidação no checkout.",
    defaultSoundName: "som_pix_gerado.wav",
    defaultSoundKey: "som_pix_gerado",
    icon: "⚡",
    badgeBg: "bg-sky-100 dark:bg-sky-950/60",
    badgeText: "text-sky-700 dark:text-sky-300",
    borderHover: "hover:border-sky-500/50",
  },
  {
    key: "sale_pending",
    label: "VENDA PENDENTE",
    description: "Boletos bancários e transações pendentes de autorização da operadora.",
    defaultSoundName: "som_venda_pendente.wav",
    defaultSoundKey: "som_venda_pendente",
    icon: "⏳",
    badgeBg: "bg-amber-100 dark:bg-amber-950/60",
    badgeText: "text-amber-700 dark:text-amber-400",
    borderHover: "hover:border-amber-500/50",
  },
  {
    key: "refund",
    label: "VENDA REEMBOLSADA",
    description: "Devoluções e estornos com atualização financeira automática.",
    defaultSoundName: "som_reembolso.wav",
    defaultSoundKey: "som_reembolso",
    icon: "↩️",
    badgeBg: "bg-orange-100 dark:bg-orange-950/60",
    badgeText: "text-orange-700 dark:text-orange-400",
    borderHover: "hover:border-orange-500/50",
  },
  {
    key: "chargeback",
    label: "CHARGEBACK",
    description: "Contestações e alertas de risco com severidade crítica.",
    defaultSoundName: "som_chargeback.wav",
    defaultSoundKey: "som_chargeback",
    icon: "🚨",
    badgeBg: "bg-red-100 dark:bg-red-950/60",
    badgeText: "text-red-700 dark:text-red-400",
    borderHover: "hover:border-red-500/50",
  },
];

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries com fallback resiliente
  const {
    data: prefData,
    isLoading: prefLoading,
    isError: prefError,
    refetch: refetchPrefs,
  } = useQuery<{ preferences: Preferences }>({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Erro ao carregar preferências");
      return res.json();
    },
    retry: 2,
    staleTime: 10000,
  });

  const {
    data: soundData,
    isLoading: soundsLoading,
    isError: soundsError,
    refetch: refetchSounds,
  } = useQuery<{ sounds: NotificationSoundRecord[] }>({
    queryKey: ["notification-sounds"],
    queryFn: async () => {
      const res = await fetch("/api/notification-sounds");
      if (!res.ok) throw new Error("Erro ao carregar sons personalizados");
      return res.json();
    },
    retry: 2,
    staleTime: 10000,
  });

  const [prefs, setPrefs] = useState<Preferences>({
    salesApproved: true,
    salesPending: true,
    pixGenerated: true,
    refunds: true,
    chargebacks: true,
    systemAlerts: true,
    integrationErrors: true,
    soundEnabled: true,
    vibrationEnabled: true,
    useCustomSounds: false,
  });

  useEffect(() => {
    if (prefData?.preferences) {
      setPrefs(prefData.preferences);
    }
  }, [prefData]);

  const updateMutation = useMutation({
    mutationFn: async (updated: Preferences) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Erro ao salvar preferências");
      return res.json();
    },
    onSuccess: (resData) => {
      if (resData.preferences) {
        setPrefs(resData.preferences);
        setSoundEnabled(resData.preferences.soundEnabled);
        setVibrationEnabled(resData.preferences.vibrationEnabled);
        setCustomSoundsEnabled(resData.preferences.useCustomSounds);
      }
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      setSuccessMsg("Preferências salvas com sucesso!");
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Erro ao atualizar preferências");
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const handleToggle = (key: keyof Preferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    if (key === "soundEnabled") setSoundEnabled(updated.soundEnabled);
    if (key === "vibrationEnabled") setVibrationEnabled(updated.vibrationEnabled);
    if (key === "useCustomSounds") setCustomSoundsEnabled(updated.useCustomSounds);
    updateMutation.mutate(updated);
  };

  const soundsMap = new Map<string, NotificationSoundRecord>();
  if (soundData?.sounds) {
    for (const s of soundData.sounds) {
      soundsMap.set(s.notificationType, s);
    }
  }

  const hasAnyApiError = prefError || soundsError;

  return (
    <div className="p-3 sm:p-6 max-w-5xl space-y-5 pb-20 sm:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/settings"
              className="p-2 rounded-xl border border-slate-200 dark:border-[#142C52] text-slate-500 hover:text-slate-900 dark:hover:text-white transition bg-white dark:bg-[#081A33]"
              title="Voltar às configurações"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <UtmTrackSymbol size={28} />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Notificações e Sons
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Escolha o áudio de cada tipo de notificação, faça upload direto do celular e personalize sua experiência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {prefLoading && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-[#0066FF]" />
              Sincronizando...
            </span>
          )}

          {successMsg && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60 text-xs font-semibold animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5" /> {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* Banner de Erro com Ação de Retry (caso falte conexão) */}
      {hasAnyApiError && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Não foi possível carregar as configurações do servidor no momento. Mostrando modo padrão.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              refetchPrefs();
              refetchSounds();
            }}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Conteúdo Principal — Renderizado Imediatamente sem Blocos Vazios */}
      <div className="space-y-5">
        {/* Seção 1: Meus Sons de Notificação */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#142C52] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#0066FF]/10 text-[#0066FF] shrink-0">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Meus sons de notificação
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha um som diferente para cada tipo de notificação. Você pode enviar um áudio diretamente do seu celular.
                </p>
              </div>
            </div>

            {/* Master Custom Sounds Switch */}
            <div
              onClick={() => handleToggle("useCustomSounds")}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all shrink-0 ${
                prefs.useCustomSounds
                  ? "bg-[#0066FF]/10 border-[#0066FF] text-[#0066FF]"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-[#142C52] text-slate-600 dark:text-slate-400"
              }`}
            >
              <div className="text-xs font-bold">
                Usar meus sons personalizados
              </div>
              <input
                type="checkbox"
                checked={prefs.useCustomSounds}
                onChange={() => {}}
                className="w-4 h-4 rounded text-[#0066FF] focus:ring-[#0066FF] border-slate-300 dark:border-[#142C52] cursor-pointer pointer-events-none"
              />
            </div>
          </div>

          {!prefs.useCustomSounds && (
            <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-semibold">Modo padrão UTM-Track ativo:</span> O aplicativo está reproduzindo os sons característicos originais. Ative a chave acima para que seus áudios personalizados sejam utilizados.
              </div>
            </div>
          )}

          {/* Grid dos 5 Tipos de Notificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {NOTIFICATION_TYPES_CONFIG.map((config) => {
              const customSound = soundsMap.get(config.key);
              return (
                <CustomSoundCard
                  key={config.key}
                  config={config}
                  customSound={customSound}
                  useCustomSoundsActive={prefs.useCustomSounds}
                  onSoundUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["notification-sounds"] });
                    setSuccessMsg(`Som de ${config.label} atualizado com sucesso!`);
                    setTimeout(() => setSuccessMsg(null), 4000);
                  }}
                  onSoundRemoved={() => {
                    queryClient.invalidateQueries({ queryKey: ["notification-sounds"] });
                    setSuccessMsg(`Som de ${config.label} removido. O som padrão será utilizado.`);
                    setTimeout(() => setSuccessMsg(null), 4000);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Seção 2: Preferências Globais de Sensorial & Áudio */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#142C52] pb-3">
            <div className="p-2 rounded-lg bg-[#00D4FF]/10 text-[#00D4FF]">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Sensorial & Dispositivo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preferências globais de áudio e feedback háptico (vibração)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            <div
              onClick={() => handleToggle("soundEnabled")}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                prefs.soundEnabled
                  ? "bg-[#0066FF]/5 border-[#0066FF] dark:bg-[#0066FF]/10"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-[#142C52] opacity-75"
              }`}
            >
              <div className="flex items-center gap-3">
                {prefs.soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-[#0066FF]" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">Sons de Alerta</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {prefs.soundEnabled ? "Ativado" : "Desativado"}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.soundEnabled}
                onChange={() => {}}
                className="w-5 h-5 rounded text-[#0066FF] focus:ring-[#0066FF] border-slate-300 dark:border-[#142C52] cursor-pointer pointer-events-none"
              />
            </div>

            <div
              onClick={() => handleToggle("vibrationEnabled")}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                prefs.vibrationEnabled
                  ? "bg-[#0066FF]/5 border-[#0066FF] dark:bg-[#0066FF]/10"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-[#142C52] opacity-75"
              }`}
            >
              <div className="flex items-center gap-3">
                <Smartphone className={`w-5 h-5 ${prefs.vibrationEnabled ? "text-[#0066FF]" : "text-slate-400"}`} />
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">Vibração no Celular</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {prefs.vibrationEnabled ? "Ativada" : "Desativada"}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.vibrationEnabled}
                onChange={() => {}}
                className="w-5 h-5 rounded text-[#0066FF] focus:ring-[#0066FF] border-slate-300 dark:border-[#142C52] cursor-pointer pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Alertas Operacionais */}
        <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#142C52] pb-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Alertas do Sistema & Integrações
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitoramento técnico de APIs, webhooks e tracking
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <label htmlFor="systemAlerts" className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">
                  Alertas críticos do sistema
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Avisos de expiração de token Meta Ads, limite de requisições ou anomalias de tracking
                </p>
              </div>
              <input
                id="systemAlerts"
                type="checkbox"
                checked={prefs.systemAlerts}
                onChange={() => handleToggle("systemAlerts")}
                className="w-5 h-5 rounded text-[#0066FF] focus:ring-[#0066FF] border-slate-300 dark:border-[#142C52] cursor-pointer"
              />
            </div>

            <div className="py-3 flex items-center justify-between gap-4">
              <div>
                <label htmlFor="integrationErrors" className="text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">
                  Falhas de integração de webhooks
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notificar quando um webhook de checkout retornar payload inválido ou erro de assinatura
                </p>
              </div>
              <input
                id="integrationErrors"
                type="checkbox"
                checked={prefs.integrationErrors}
                onChange={() => handleToggle("integrationErrors")}
                className="w-5 h-5 rounded text-[#0066FF] focus:ring-[#0066FF] border-slate-300 dark:border-[#142C52] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Seção 4: Teste Real de Notificação Push */}
        <PushTestSection />
      </div>
    </div>
  );
}

/**
 * Componente Individual de Card de Som Personalizado
 */
function CustomSoundCard({
  config,
  customSound,
  useCustomSoundsActive,
  onSoundUpdated,
  onSoundRemoved,
}: {
  config: NotificationTypeConfig;
  customSound?: NotificationSoundRecord;
  useCustomSoundsActive: boolean;
  onSoundUpdated: () => void;
  onSoundRemoved: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handlePlayPreview = async () => {
    if (isPlaying) {
      stopCurrentSound();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const audio = await playNotificationSound(config.defaultSoundKey, customSound?.fileUrl);

    if (audio) {
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
    } else {
      setTimeout(() => setIsPlaying(false), 2500);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadWarning(null);

    try {
      let duration: number | undefined = undefined;
      try {
        const audioEl = new Audio(URL.createObjectURL(file));
        await new Promise((resolve) => {
          audioEl.onloadedmetadata = () => {
            duration = audioEl.duration;
            resolve(true);
          };
          audioEl.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 1500);
        });
      } catch {
        // ignore client-side duration check error
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("notificationType", config.key);
      if (duration) formData.append("duration", String(duration));

      const res = await fetch("/api/notification-sounds", {
        method: "POST",
        body: formData,
      });

      // Guard against HTML error pages (Vercel 5xx / CDN errors) that have no JSON body
      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        try { data = await res.json(); } catch { /* non-JSON body */ }
      }
      if (!res.ok) {
        throw new Error(data.error || `Falha ao enviar arquivo de som (HTTP ${res.status})`);
      }

      if (data.warning) {
        setUploadWarning(data.warning);
      }

      onSoundUpdated();
    } catch (err: any) {
      alert(err.message || "Erro ao fazer upload do som");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveSound = async () => {
    if (!customSound) return;
    if (!confirm(`Remover som personalizado de ${config.label} e voltar ao padrão?`)) return;

    setIsRemoving(true);
    try {
      const res = await fetch(`/api/notification-sounds/${customSound.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao remover som");
      onSoundRemoved();
    } catch (err: any) {
      alert(err.message || "Falha ao remover som personalizado");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsTestingPush(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: config.key,
          sound: config.defaultSoundKey,
          customSoundUrl: customSound?.fileUrl,
          customSoundName: customSound?.originalFileName,
        }),
      });
      // Guard against HTML error pages (Vercel 5xx / CDN errors) that return no JSON body
      const ctPush = res.headers.get("content-type") || "";
      let data: any = {};
      try {
        if (ctPush.includes("application/json")) data = await res.json();
      } catch { /* non-JSON body — keep data as {} */ }
      if (data.success) {
        setTestResult(`✓ Push enviado para ${data.devicesCount || 0} dispositivo(s).`);
        await playNotificationSound(config.defaultSoundKey, customSound?.fileUrl);
      } else if (data.warning) {
        setTestResult(`⚠️ ${data.warning}`);
        await playNotificationSound(config.defaultSoundKey, customSound?.fileUrl);
      } else {
        setTestResult(`❌ ${data.error || "Erro ao enviar push"}`);
      }
    } catch {
      setTestResult("❌ Erro ao enviar teste");
    } finally {
      setIsTestingPush(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const isCustomActive = !!customSound && useCustomSoundsActive;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
        isCustomActive
          ? "bg-blue-50/30 dark:bg-[#0E2547]/60 border-[#0066FF]/40 shadow-sm"
          : "bg-slate-50/70 dark:bg-[#0A1F3D]/40 border-slate-200 dark:border-[#142C52]"
      } ${config.borderHover}`}
    >
      {/* Header do Card */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              {config.label}
              {isCustomActive ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  ✓ Som personalizado ativo
                </span>
              ) : (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${config.badgeBg} ${config.badgeText}`}>
                  Padrão UTM-Track
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Caixa de Status e Informações do Arquivo */}
      <div className="p-3 rounded-xl bg-white dark:bg-[#081A33] border border-slate-200/80 dark:border-[#142C52] space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileAudio className={`w-4 h-4 shrink-0 ${customSound ? "text-[#0066FF]" : "text-slate-400"}`} />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
              {customSound ? customSound.originalFileName : "Nenhum som personalizado (usando padrão)"}
            </span>
          </div>
          {customSound && (
            <div className="text-[10px] text-slate-400 dark:text-slate-400 font-mono shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {formatFileSize(customSound.fileSize)}
              {customSound.duration ? ` • ${customSound.duration.toFixed(1)}s` : ""}
            </div>
          )}
        </div>

        {uploadWarning && (
          <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
            {uploadWarning}
          </div>
        )}

        {testResult && (
          <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
            {testResult}
          </div>
        )}
      </div>

      {/* Hidden Mobile Native File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Botões de Ação — Mobile First */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-[#142C52]/60">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Tocar Prévia */}
          <button
            type="button"
            onClick={handlePlayPreview}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              isPlaying
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pausar
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Ouvir
              </>
            )}
          </button>

          {/* Testar Notificação Push */}
          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={isTestingPush}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#142C52] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
            title="Dispara notificação de teste com este som"
          >
            <Bell className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Testar notificação</span>
            <span className="sm:hidden">Testar</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Adicionar / Alterar Som */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0066FF] hover:bg-[#0052cc] text-white flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando...
              </>
            ) : customSound ? (
              <>
                <Upload className="w-3.5 h-3.5" /> Alterar som
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> + Adicionar som
              </>
            )}
          </button>

          {/* Remover Som Personalizado */}
          {customSound && (
            <button
              type="button"
              onClick={handleRemoveSound}
              disabled={isRemoving}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition disabled:opacity-50"
              title="Remover som personalizado e voltar ao padrão"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Seção de Teste de Notificações Push no Celular
 */
function PushTestSection() {
  const [isSending, setIsSending] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);

  const testOptions = [
    { type: "general", label: "🔔 Geral", sound: "som_venda_aprovada" as SoundType, icon: "🔔", bgHover: "hover:bg-blue-50 dark:hover:bg-blue-950/40", borderHover: "hover:border-blue-500/50" },
    { type: "sale_approved", label: "💰 Venda Aprovada", sound: "som_venda_aprovada" as SoundType, icon: "💰", bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/40", borderHover: "hover:border-emerald-500/50" },
    { type: "pix_pending", label: "⚡ Pix Gerado", sound: "som_pix_gerado" as SoundType, icon: "⚡", bgHover: "hover:bg-sky-50 dark:hover:bg-sky-950/40", borderHover: "hover:border-sky-500/50" },
    { type: "sale_pending", label: "⏳ Venda Pendente", sound: "som_venda_pendente" as SoundType, icon: "⏳", bgHover: "hover:bg-amber-50 dark:hover:bg-amber-950/40", borderHover: "hover:border-amber-500/50" },
    { type: "refund", label: "↩️ Reembolso", sound: "som_reembolso" as SoundType, icon: "↩️", bgHover: "hover:bg-orange-50 dark:hover:bg-orange-950/40", borderHover: "hover:border-orange-500/50" },
    { type: "chargeback", label: "🚨 Chargeback", sound: "som_chargeback" as SoundType, icon: "🚨", bgHover: "hover:bg-red-50 dark:hover:bg-red-950/40", borderHover: "hover:border-red-500/50" },
  ];

  const handleSendTest = async (type = "general", sound: SoundType = "som_venda_aprovada") => {
    setIsSending(true);
    setActiveType(type);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, sound }),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({
          type: "success",
          text: data.message || `Push de ${type} enviado com sucesso para ${data.devicesCount} dispositivo(s).`,
        });
        await playNotificationSound(sound, data.notification?.customSoundUrl);
      } else if (data.warning) {
        setStatusMsg({
          type: "warning",
          text: data.message || "Nenhum dispositivo registrado no FCM. Abra o aplicativo UTM-Track no celular.",
        });
        await playNotificationSound(sound, data.notification?.customSoundUrl);
      } else {
        setStatusMsg({
          type: "error",
          text: data.error || "Não foi possível enviar a notificação. Verifique a configuração do dispositivo.",
        });
      }
    } catch {
      setStatusMsg({
        type: "error",
        text: "Erro de conexão ao solicitar envio do teste.",
      });
    } finally {
      setIsSending(false);
      setActiveType(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Testar Notificações Push no Celular
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Envie um Push Notification real via FCM para verificar o recebimento, som ativo e vibração no seu Android/iOS.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Selecione o tipo de evento para disparar o Push Notification correspondente:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
          {testOptions.map((opt) => {
            const isLoadingThis = isSending && activeType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSendTest(opt.type, opt.sound)}
                disabled={isSending}
                className={`p-3 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50/60 dark:bg-slate-900/60 text-left transition-all flex flex-col justify-between gap-1.5 ${opt.bgHover} ${opt.borderHover} disabled:opacity-50`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{opt.icon}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                    {opt.sound.replace("som_", "")}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {isLoadingThis ? "Enviando Push..." : opt.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border animate-in fade-in ${
            statusMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : statusMsg.type === "warning"
              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="font-semibold">{statusMsg.text}</div>
        </div>
      )}
    </div>
  );
}