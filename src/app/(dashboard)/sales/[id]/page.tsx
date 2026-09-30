"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertOctagon,
  Volume2,
  DollarSign,
  Sparkles,
  Link2,
  Calendar,
  Share2,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { UtmTrackSymbol } from "@/components/brand/symbol";
import { playNotificationSound, SoundType } from "@/lib/sound";

export default function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${id}`);
      if (!res.ok) throw new Error("Venda não encontrada");
      return res.json();
    },
  });

  const sale = data?.sale;
  const trackingSession = data?.trackingSession;
  const financials = data?.financials;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4" /> Venda Aprovada
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            <Clock className="w-4 h-4" /> Pendente / Pix Gerado
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <RotateCcw className="w-4 h-4" /> Reembolsada
          </span>
        );
      case "chargeback":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
            <AlertOctagon className="w-4 h-4" /> Chargeback Recebido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getSoundForStatus = (status: string): SoundType => {
    if (status === "approved") return "som_venda_aprovada";
    if (status === "pending") return "som_pix_gerado";
    if (status === "refunded") return "som_reembolso";
    if (status === "chargeback") return "som_chargeback";
    return "som_venda_aprovada";
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-48" />
        <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mx-auto">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pedido não encontrado</h2>
        <p className="text-xs text-gray-500">O ID informado não existe ou não pertence a este workspace.</p>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0066FF] text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Vendas
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/sales"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-[#0066FF] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Lista de Vendas
        </Link>
        <button
          onClick={() => playNotificationSound(getSoundForStatus(sale.status))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/50 text-[#0066FF] dark:text-[#00D4FF] border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition"
        >
          <Volume2 className="w-4 h-4" /> Tocar Alerta Sonoro
        </button>
      </div>

      {/* Hero Card */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <UtmTrackSymbol size={28} />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Pedido #{sale.externalId}
              </h1>
              {getStatusBadge(sale.status)}
            </div>
            <p className="text-xs text-gray-500 font-mono">
              Plataforma: <span className="uppercase font-bold text-gray-700 dark:text-gray-300">{sale.platform}</span> | ID Interno: {sale.id}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-400">Valor Bruto</div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">
              {formatCurrency(sale.grossAmount, sale.currency)}
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-[11px] text-gray-500">Faturamento Bruto</div>
            <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
              {formatCurrency(financials?.grossAmount || sale.grossAmount, sale.currency)}
            </div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-[11px] text-gray-500">Taxas &amp; Gateway Estimadas</div>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {formatCurrency(financials?.gatewayFee || 0, sale.currency)}
            </div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-[11px] text-gray-500">Faturamento Líquido Real</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(financials?.netAmount || sale.netAmount, sale.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Attribution & Meta Ads Card */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <Sparkles className="w-5 h-5 text-[#0066FF]" />
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Atribuição Inteligente Meta Ads
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Campanha UTM / Meta:</span>
            <p className="font-semibold text-[#0066FF] dark:text-[#00D4FF] text-sm mt-0.5">
              {sale.utmCampaign || "Sem campanha vinculada"}
            </p>
          </div>

          <div>
            <span className="text-gray-500">Origem &amp; Mídia (Source / Medium):</span>
            <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
              {sale.utmSource || "—"} / {sale.utmMedium || "—"}
            </p>
          </div>

          <div>
            <span className="text-gray-500">Meta Click ID (fbclid):</span>
            <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300 break-all bg-gray-50 dark:bg-gray-800 p-2 rounded-lg mt-0.5">
              {sale.fbclid || "Não informado no checkout"}
            </p>
          </div>

          <div>
            <span className="text-gray-500">Cookies Meta Browser (_fbp / _fbc):</span>
            <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300 break-all bg-gray-50 dark:bg-gray-800 p-2 rounded-lg mt-0.5">
              {sale.fbp || sale.fbc || "Não informado"}
            </p>
          </div>
        </div>

        {trackingSession && (
          <div className="p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 text-xs space-y-1">
            <div className="font-semibold text-sky-800 dark:text-sky-300">Sessão de Tracking Vinculada</div>
            <div className="text-gray-600 dark:text-gray-400">
              Página de Entrada: <span className="font-mono">{trackingSession.landingPage || "—"}</span>
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              Dispositivo / User-Agent: <span className="text-[11px] truncate block">{trackingSession.userAgent || "—"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Card */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" /> Linha do Tempo de Eventos
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">Pedido Realizado</div>
              <div className="text-gray-500 text-[11px]">Recebimento do webhook de criação</div>
            </div>
            <div className="font-mono text-gray-700 dark:text-gray-300">{formatDateTime(sale.orderedAt)}</div>
          </div>

          {sale.approvedAt && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
              <div>
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">Pagamento Aprovado</div>
                <div className="text-emerald-700 dark:text-emerald-400 text-[11px]">Compensação do Pix/Cartão e disparo de áudio Cha-ching</div>
              </div>
              <div className="font-mono text-emerald-800 dark:text-emerald-300">{formatDateTime(sale.approvedAt)}</div>
            </div>
          )}

          {sale.refundedAt && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
              <div>
                <div className="font-semibold text-amber-800 dark:text-amber-300">Estorno Concluído</div>
                <div className="text-amber-700 dark:text-amber-400 text-[11px]">Valor revertido ao comprador</div>
              </div>
              <div className="font-mono text-amber-800 dark:text-amber-300">{formatDateTime(sale.refundedAt)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
