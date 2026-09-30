"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Fingerprint, Trash2, ArrowLeft, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import { UtmTrackSymbol } from "@/components/brand/symbol";

const PASSKEY_REGISTERED_KEY = "utm_passkey_registered";

type Credential = {
  id: string;
  credentialId: string;
  deviceName: string | null;
  deviceType: string | null;
  backedUp: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function SecurityPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/webauthn/credentials");
      if (!res.ok) throw new Error("Erro ao carregar dispositivos");
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dispositivos autorizados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleRemove = async (id: string, deviceName: string | null) => {
    if (!confirm(`Remover "${deviceName || "este dispositivo"}" da lista de biometria autorizada?`)) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/auth/webauthn/credentials?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
        // If no credentials left, clear local flag
        if (credentials.length <= 1) {
          localStorage.removeItem(PASSKEY_REGISTERED_KEY);
        }
        setMsg("Dispositivo removido. A biometria deste dispositivo não será mais aceita.");
        setTimeout(() => setMsg(null), 5000);
      } else {
        setMsg(data.error || "Erro ao remover dispositivo");
        setTimeout(() => setMsg(null), 5000);
      }
    } catch {
      setMsg("Erro ao remover dispositivo. Tente novamente.");
      setTimeout(() => setMsg(null), 5000);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-5 pb-20 sm:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="p-2 rounded-xl border border-slate-200 dark:border-[#142C52] text-slate-500 hover:text-slate-900 dark:hover:text-white transition bg-white dark:bg-[#081A33]"
          title="Voltar às configurações"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <UtmTrackSymbol size={28} />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Segurança
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gerenciar dispositivos autorizados com biometria
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}

      {/* Biometric Devices */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#142C52] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#0066FF]/10 text-[#0066FF]">
              <Fingerprint className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Dispositivos autorizados</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Dispositivos com login biométrico ativado</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchCredentials}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Carregando dispositivos...
          </div>
        ) : error ? (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : credentials.length === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <Fingerprint className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm font-medium">Nenhum dispositivo com biometria registrado</p>
            <p className="text-xs">
              Faça login com e-mail e senha para ativar a biometria neste dispositivo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A1F3D]/60 border border-slate-200 dark:border-[#142C52]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[#0066FF]/10 text-[#0066FF] shrink-0">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {cred.deviceName || "Dispositivo"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                      <div>Cadastrado em {formatDate(cred.createdAt)}</div>
                      <div>Último uso: {formatDate(cred.lastUsedAt)}</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(cred.id, cred.deviceName)}
                  disabled={removing === cred.id}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition disabled:opacity-50 shrink-0"
                  title="Remover biometria deste dispositivo"
                >
                  {removing === cred.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-xs text-slate-400 dark:text-slate-500 space-y-1">
          <p>
            <strong>Nota:</strong> Remover um dispositivo revoga apenas o acesso biométrico.
            Sua senha e conta permanecem intactos.
          </p>
          <p>
            Os dados biométricos (impressão digital, rosto) nunca são armazenados no UTM-Track.
            Apenas a chave pública criptográfica do dispositivo é registrada.
          </p>
        </div>
      </div>
    </div>
  );
}
