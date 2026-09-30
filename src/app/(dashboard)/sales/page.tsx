"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertOctagon,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Percent,
  ExternalLink,
  ShoppingBag,
  Volume2,
  Calendar,
  X,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { UtmTrackSymbol } from "@/components/brand/symbol";
import { playNotificationSound, SoundType } from "@/lib/sound";
import { HourlySalesBreakdown } from "@/components/sales/hourly-sales-breakdown";

type SaleItem = {
  id: string;
  platform: string;
  externalId: string;
  externalRef?: string;
  status: "approved" | "pending" | "refunded" | "chargeback" | "cancelled";
  grossAmount: number;
  netAmount: number;
  currency: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  sessionId?: string;
  customerEmail?: string;
  orderedAt: string;
  approvedAt?: string;
  refundedAt?: string;
  attributionRecord?: {
    id: string;
    campaignId?: string;
    adSetId?: string;
    adId?: string;
    matchedBy?: string;
    confidence?: number;
  } | null;
};

type SalesResponse = {
  sales: SaleItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  stats: {
    totalGross: number;
    totalNet: number;
    totalPending: number;
    totalRefunded: number;
    totalChargeback: number;
    countApproved: number;
    countPending: number;
    countRefunded: number;
    countChargeback: number;
    countTotal: number;
    approvalRate: number;
  };
};

export default function SalesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selectedSale, setSelectedSale] = useState<SaleItem | null>(null);
  const [viewMode, setViewMode] = useState<"feed" | "hourly">("feed");

  const { data, isLoading } = useQuery<SalesResponse>({
    queryKey: ["sales-list", statusFilter, platformFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (platformFilter !== "all") params.append("platform", platformFilter);
      if (search.trim()) params.append("search", search.trim());
      const res = await fetch(`/api/sales?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar vendas");
      return res.json();
    },
    refetchInterval: 8000,
  });

  const stats = data?.stats || {
    totalGross: 0,
    totalNet: 0,
    totalPending: 0,
    totalRefunded: 0,
    totalChargeback: 0,
    countApproved: 0,
    countPending: 0,
    countRefunded: 0,
    countChargeback: 0,
    countTotal: 0,
    approvalRate: 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovada
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            <Clock className="w-3.5 h-3.5" /> Pendente / Pix
          </span>
        );
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <RotateCcw className="w-3.5 h-3.5" /> Reembolsada
          </span>
        );
      case "chargeback":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
            <AlertOctagon className="w-3.5 h-3.5" /> Chargeback
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <UtmTrackSymbol size={32} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestão de Vendas &amp; Atribuição</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Feed unificado de pedidos, conciliação financeira de Pix, reembolsos e matching em tempo real com Meta Ads
          </p>
        </div>

        {/* Alternador de Visualização: Feed vs Vendas por Horário */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={() => setViewMode("feed")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "feed"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            📋 Feed de Pedidos
          </button>
          <button
            onClick={() => setViewMode("hourly")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "hourly"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            ⏰ Vendas por Horário (24h)
          </button>
        </div>
      </div>

      {viewMode === "hourly" ? (
        <HourlySalesBreakdown initialPlatform={platformFilter} />
      ) : (
        <>
          {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Faturamento Aprovado</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(stats.totalGross)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {stats.countApproved} pedidos confirmados
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Vendas Pendentes / Pix</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1">
            {formatCurrency(stats.totalPending)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {stats.countPending} aguardando pagamento
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Reembolsos</span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(stats.totalRefunded)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {stats.countRefunded} estornados
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Chargebacks</span>
            <AlertOctagon className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
            {formatCurrency(stats.totalChargeback)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {stats.countChargeback} contestações
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Taxa de Aprovação</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {stats.approvalRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {stats.countTotal} pedidos totais
          </div>
        </div>
      </div>

      {/* Filters Bar & Status Tabs */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === "all"
                  ? "bg-[#0066FF] text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Todas ({stats.countTotal})
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === "approved"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Aprovadas ({stats.countApproved})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === "pending"
                  ? "bg-sky-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Pendentes / Pix ({stats.countPending})
            </button>
            <button
              onClick={() => setStatusFilter("refunded")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === "refunded"
                  ? "bg-amber-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Reembolsos ({stats.countRefunded})
            </button>
            <button
              onClick={() => setStatusFilter("chargeback")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === "chargeback"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Chargebacks ({stats.countChargeback})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              <option value="all">Todas as Plataformas</option>
              <option value="hotmart">Hotmart</option>
              <option value="shopify">Shopify</option>
              <option value="yampi">Yampi</option>
              <option value="cacto">Cacto</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID do pedido, transação, e-mail, UTM Campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
          />
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Data / Hora</th>
                <th className="p-3.5">Plataforma</th>
                <th className="p-3.5">ID Pedido / Transação</th>
                <th className="p-3.5">Valor Bruto</th>
                <th className="p-3.5">UTM Campanha</th>
                <th className="p-3.5">Atribuição</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mx-auto" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mx-auto" />
                    </div>
                  </td>
                </tr>
              ) : !data?.sales || data.sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500">
                    <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Nenhuma venda encontrada</p>
                    <p className="text-xs text-gray-400 mt-1">
                      As vendas recebidas via webhooks ou simuladas aparecerão aqui automaticamente.
                    </p>
                  </td>
                </tr>
              ) : (
                data.sales.map((sale) => {
                  const attribution = sale.attributionRecord;
                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="p-3.5">{getStatusBadge(sale.status)}</td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatDateTime(sale.orderedAt)}
                      </td>
                      <td className="p-3.5">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {sale.platform}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-gray-900 dark:text-white font-medium">
                        {sale.externalId}
                      </td>
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        {formatCurrency(sale.grossAmount, sale.currency)}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-400">
                        {sale.utmCampaign ? (
                          <span className="font-medium text-[#0066FF] dark:text-[#00D4FF]">
                            {sale.utmCampaign}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {attribution ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                            <Sparkles className="w-3 h-3" />
                            {attribution.matchedBy ? `Match ${attribution.matchedBy}` : "Atribuído"}
                          </span>
                        ) : sale.fbclid || sale.fbp ? (
                          <span className="text-[11px] text-sky-600 dark:text-sky-400">
                            Meta Tracking
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#0066FF] dark:text-[#00D4FF] hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded transition"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
    )}

      {/* Sale Details Modal / Drawer */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UtmTrackSymbol size={24} />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalhes da Venda</h2>
                  {getStatusBadge(selectedSale.status)}
                </div>
                <p className="text-xs text-gray-500 font-mono">
                  ID Interno: {selectedSale.id} | Plataforma: {selectedSale.platform.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Details */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs">
              <div>
                <span className="text-gray-500">Valor Bruto:</span>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(selectedSale.grossAmount, selectedSale.currency)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Taxa Estimada:</span>
                <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatCurrency(Math.max(0, selectedSale.grossAmount - selectedSale.netAmount), selectedSale.currency)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Valor Líquido:</span>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(selectedSale.netAmount, selectedSale.currency)}
                </p>
              </div>
            </div>

            {/* Attribution Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Atribuição Meta Ads &amp; Rastreamento
              </h3>
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 text-xs">
                <div>
                  <span className="text-gray-500">UTM Source / Medium:</span>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedSale.utmSource || "—"} / {selectedSale.utmMedium || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">UTM Campaign:</span>
                  <p className="font-semibold text-[#0066FF] dark:text-[#00D4FF]">
                    {selectedSale.utmCampaign || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Meta fbclid:</span>
                  <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate">
                    {selectedSale.fbclid || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Meta fbp / fbc:</span>
                  <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate">
                    {selectedSale.fbp || selectedSale.fbc || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Timestamps Timeline */}
            <div className="space-y-2 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Linha do Tempo do Pedido</h3>
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Pedido Criado:</span>
                  <span className="font-mono text-gray-900 dark:text-white">{formatDateTime(selectedSale.orderedAt)}</span>
                </div>
                {selectedSale.approvedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Pagamento Confirmado (Aprovada):</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatDateTime(selectedSale.approvedAt)}</span>
                  </div>
                )}
                {selectedSale.refundedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Venda Reembolsada:</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">{formatDateTime(selectedSale.refundedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <Link
                href={`/sales/${selectedSale.id}`}
                className="text-xs text-[#0066FF] hover:underline flex items-center gap-1 font-semibold"
              >
                Abrir em Página Própria <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
