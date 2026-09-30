"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  formatCurrency,
  formatNumber,
  formatMetric,
  formatPercent,
} from "@/lib/utils";
import {
  ArrowUpDown,
  Download,
  Search,
  Filter,
  Columns,
  CheckSquare,
  Square,
  RefreshCw,
  Award,
  TrendingUp,
  Zap,
  AlertTriangle,
  Play,
  Pause,
  Copy,
  Edit3,
  Check,
  X,
  Plus,
  Minus,
} from "lucide-react";

export type MetaTableLevel = "campaign" | "adset" | "ad";
export type MetaRecommendation =
  | "scale"
  | "profitable"
  | "breakeven"
  | "pause"
  | "learning"
  | "inactive";

export interface MetaTableItem {
  id: string;
  externalId?: string;
  name: string;
  parentName?: string;
  campaignName?: string;
  adAccountName?: string;
  previewUrl?: string | null;
  status: string;
  budget?: number | null;
  spend: number;
  sales: number;
  realSalesCount?: number;
  cpa: number | null;
  revenue: number;
  netRevenue?: number;
  profit: number;
  roas: number | null;
  grossRoas?: number | null;
  roi: number | null;
  impressions: number;
  margin: number | null;
  cpm: number | null;
  clicks: number;
  cpc: number | null;
  ctr: number | null;
  ic: number;
  cpi: number | null;
  recommendation?: MetaRecommendation;
}

interface CampaignsTableProps {
  level?: MetaTableLevel;
  adAccountId?: string;
  periodFrom?: string;
  periodTo?: string;
}

export function getRecommendationBadge(rec?: MetaRecommendation) {
  switch (rec) {
    case "scale":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60 shadow-xs whitespace-nowrap">
          <span>🚀</span> Escalar
        </span>
      );
    case "profitable":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-300/60 dark:border-teal-700/60 whitespace-nowrap">
          <span>🟢</span> Lucrativo
        </span>
      );
    case "breakeven":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 whitespace-nowrap">
          <span>🟡</span> Atenção
        </span>
      );
    case "pause":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/60 whitespace-nowrap">
          <span>🔴</span> Pausar
        </span>
      );
    case "learning":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/60 dark:border-sky-700/60 whitespace-nowrap">
          <span>🧪</span> Em Teste
        </span>
      );
    case "inactive":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-normal bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 whitespace-nowrap">
          <span>⏸️</span> Sem Gasto
        </span>
      );
  }
}

export function CampaignsTable({
  level = "campaign",
  adAccountId = "all",
  periodFrom,
  periodTo,
}: CampaignsTableProps) {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recommendationFilter, setRecommendationFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof MetaTableItem>(level === "ad" ? "profit" : "spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // Modais de Edição
  const [editingBudget, setEditingBudget] = useState<{ id: string; name: string; budget: number } | null>(null);
  const [editingName, setEditingName] = useState<{ id: string; name: string } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Colunas configuráveis
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    status: true,
    recommendation: true,
    name: true,
    budget: level !== "ad",
    spend: true,
    sales: true,
    cpa: true,
    revenue: true,
    netRevenue: true,
    profit: true,
    roas: true,
    roi: true,
    impressions: true,
    margin: true,
    cpm: true,
    clicks: true,
    cpc: true,
    ctr: true,
    ic: true,
    cpi: true,
    actions: true,
  });

  const { data, isLoading, refetch, isFetching } = useQuery<{ data: MetaTableItem[] }>({
    queryKey: ["meta-insights-table", level, adAccountId, statusFilter, searchTerm, periodFrom, periodTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        level,
        ...(adAccountId !== "all" ? { adAccountId } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(periodFrom ? { from: periodFrom } : {}),
        ...(periodTo ? { to: periodTo } : {}),
      });
      const res = await fetch(`/api/meta/insights?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar dados da tabela");
      return res.json();
    },
  });

  const items = data?.data || [];

  // Mutação para Atualizações (Status, Orçamento, Nome e Ações em Massa)
  const manageMutation = useMutation({
    mutationFn: async (payload: {
      level: MetaTableLevel;
      id?: string;
      ids?: string[];
      status?: string;
      name?: string;
      budget?: number;
      budgetChangePercent?: number;
    }) => {
      const res = await fetch("/api/meta/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar na Meta");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-insights-table"] });
      setActionFeedback({
        message: data.updatedCount > 1
          ? `${data.updatedCount} itens atualizados com sucesso!`
          : "Alteração aplicada com sucesso na Meta!",
        type: "success",
      });
      setTimeout(() => setActionFeedback(null), 4000);
      setEditingBudget(null);
      setEditingName(null);
    },
    onError: (err: Error) => {
      setActionFeedback({
        message: `Falha: ${err.message}`,
        type: "error",
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
  });

  // Mutação para Duplicação
  const duplicateMutation = useMutation({
    mutationFn: async (payload: { level: MetaTableLevel; id: string; suffix?: string }) => {
      const res = await fetch("/api/meta/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao duplicar");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-insights-table"] });
      setActionFeedback({
        message: data.message || "Duplicado com sucesso como Pausado!",
        type: "success",
      });
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: Error) => {
      setActionFeedback({
        message: `Erro ao duplicar: ${err.message}`,
        type: "error",
      });
      setTimeout(() => setActionFeedback(null), 6000);
    },
  });

  // Métricas agregadas para os KPI Cards
  const topCreative =
    items.length > 0
      ? [...items].sort((a, b) => b.profit - a.profit)[0]
      : null;
  const scaleCount = items.filter((i) => i.recommendation === "scale").length;
  const profitableCount = items.filter((i) => i.recommendation === "profitable").length;
  const breakevenCount = items.filter((i) => i.recommendation === "breakeven").length;
  const pauseCount = items.filter((i) => i.recommendation === "pause").length;
  const learningCount = items.filter((i) => i.recommendation === "learning").length;

  const totalNetProfit = items.reduce((acc, i) => acc + (i.profit || 0), 0);
  const totalNetRevenue = items.reduce((acc, i) => acc + (i.netRevenue ?? (i.revenue * 0.9)), 0);
  const totalSpend = items.reduce((acc, i) => acc + (i.spend || 0), 0);
  const overallRoas = totalSpend > 0 ? totalNetRevenue / totalSpend : null;

  // Filtragem por Recomendação
  const filteredItems = items.filter((item) => {
    if (recommendationFilter !== "all") {
      if (item.recommendation !== recommendationFilter) return false;
    }
    return true;
  });

  const handleSort = (field: keyof MetaTableItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedItems = [...filteredItems].sort((a, b) => {
    const valA = a[sortField] ?? -Infinity;
    const valB = b[sortField] ?? -Infinity;
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSelectAll = () => {
    if (selectedRowIds.length === filteredItems.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredItems.map((i) => i.id));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle Rápido de Status (Pausar / Ativar)
  const handleToggleStatus = (item: MetaTableItem) => {
    const newStatus = item.status?.toUpperCase() === "ACTIVE" ? "PAUSED" : "ACTIVE";
    manageMutation.mutate({
      level,
      id: item.id,
      status: newStatus,
    });
  };

  // Ações em Massa
  const handleBulkStatus = (status: "ACTIVE" | "PAUSED") => {
    if (!selectedRowIds.length) return;
    manageMutation.mutate({
      level,
      ids: selectedRowIds,
      status,
    });
  };

  const handleBulkBudgetScale = (percent: number) => {
    if (!selectedRowIds.length) return;
    manageMutation.mutate({
      level,
      ids: selectedRowIds,
      budgetChangePercent: percent,
    });
  };

  const handleBulkDuplicate = async () => {
    if (!selectedRowIds.length) return;
    for (const id of selectedRowIds) {
      duplicateMutation.mutate({ level, id });
    }
    setSelectedRowIds([]);
  };

  // Linha de Totalização
  const totals = sortedItems.reduce(
    (acc, curr) => {
      acc.spend += curr.spend || 0;
      acc.sales += curr.sales || 0;
      acc.revenue += curr.revenue || 0;
      acc.netRevenue += curr.netRevenue ?? (curr.revenue * 0.9);
      acc.profit += curr.profit || 0;
      acc.impressions += curr.impressions || 0;
      acc.clicks += curr.clicks || 0;
      acc.ic += curr.ic || 0;
      return acc;
    },
    { spend: 0, sales: 0, revenue: 0, netRevenue: 0, profit: 0, impressions: 0, clicks: 0, ic: 0 }
  );

  const totalCpa = totals.sales > 0 ? totals.spend / totals.sales : null;
  const totalRoas = totals.spend > 0 ? totals.netRevenue / totals.spend : null;
  const totalGrossRoas = totals.spend > 0 ? totals.revenue / totals.spend : null;
  const totalRoi = totals.spend > 0 ? (totals.profit / totals.spend) * 100 : null;
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : null;
  const totalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null;
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : null;
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
  const totalCpi = totals.ic > 0 ? totals.spend / totals.ic : null;

  const exportCSV = () => {
    const headers = [
      "Nome",
      "Recomendação",
      "Status",
      "Gasto (R$)",
      "Vendas",
      "CPA (R$)",
      "Faturamento (R$)",
      "Receita Líquida (R$)",
      "Lucro Líquido Real (R$)",
      "ROAS Líquido",
      "ROAS Bruto",
      "ROI (%)",
      "Impressões",
      "Margem (%)",
      "CPM (R$)",
      "Cliques",
      "CPC (R$)",
      "CTR (%)",
      "ICs",
      "CPI (R$)",
    ];
    const lines = [headers.join(";")];
    for (const item of sortedItems) {
      lines.push(
        [
          `"${item.name.replace(/"/g, '""')}"`,
          item.recommendation || "",
          item.status,
          item.spend.toFixed(2),
          item.sales,
          item.cpa !== null ? item.cpa.toFixed(2) : "",
          item.revenue.toFixed(2),
          (item.netRevenue ?? (item.revenue * 0.9)).toFixed(2),
          item.profit.toFixed(2),
          item.roas !== null ? item.roas.toFixed(2) : "",
          item.grossRoas !== null && item.grossRoas !== undefined ? item.grossRoas.toFixed(2) : "",
          item.roi !== null ? item.roi.toFixed(2) : "",
          item.impressions,
          item.margin !== null ? item.margin.toFixed(2) : "",
          item.cpm !== null ? item.cpm.toFixed(2) : "",
          item.clicks,
          item.cpc !== null ? item.cpc.toFixed(2) : "",
          item.ctr !== null ? item.ctr.toFixed(2) : "",
          item.ic,
          item.cpi !== null ? item.cpi.toFixed(2) : "",
        ].join(";")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meta-${level}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const levelTitle =
    level === "campaign"
      ? "Campanhas"
      : level === "adset"
      ? "Conjuntos de Anúncios"
      : "Criativos / Anúncios";

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200 ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards de Criativos Mais Lucrativos (quando level === 'ad') */}
      {level === "ad" && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in">
          {/* Top Criativo */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-amber-400/80 transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                Top Criativo Mais Lucrativo
              </span>
              {topCreative?.recommendation && getRecommendationBadge(topCreative.recommendation)}
            </div>
            <div className="mt-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={topCreative?.name}>
                {topCreative?.name || "Nenhum criativo ativo"}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {topCreative ? formatCurrency(topCreative.profit) : "R$ 0,00"}
                </span>
                <span className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400">
                  ROAS Líq: {topCreative ? formatMetric(topCreative.roas, "ratio") : "0x"}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-[#142C52]/60 flex items-center justify-between">
              <span>Vendas: <strong className="text-slate-700 dark:text-slate-200">{topCreative?.sales || 0}</strong></span>
              <span>Gasto: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(topCreative?.spend || 0)}</strong></span>
            </div>
          </div>

          {/* Lucro Líquido Real Total */}
          <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-blue-400/80 transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                Lucro Líquido Real Total
              </span>
              <span className="text-[10px] font-mono text-slate-400">Após gateways</span>
            </div>
            <div className="mt-2">
              <span
                className={`text-xl font-mono font-bold ${
                  totalNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatCurrency(totalNetProfit)}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Líquido Real: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totalNetRevenue)}</span>
              </p>
            </div>
            <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-[#142C52]/60 flex items-center justify-between font-mono">
              <span>Gasto Meta: {formatCurrency(totalSpend)}</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">ROAS: {formatMetric(overallRoas, "ratio")}</span>
            </div>
          </div>

          {/* Criativos para Escalar */}
          <div
            onClick={() => setRecommendationFilter(recommendationFilter === "scale" ? "all" : "scale")}
            className={`bg-white dark:bg-[#081A33] border rounded-xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:border-emerald-400 ${
              recommendationFilter === "scale"
                ? "border-emerald-500 ring-2 ring-emerald-500/20"
                : "border-slate-200/90 dark:border-[#142C52]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                Prontos para Escala
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                ROAS ≥ 2.0x
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {scaleCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">anúncios</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Alta lucratividade e margem para aumentar orçamento
              </p>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 pt-2 border-t border-slate-100 dark:border-[#142C52]/60 font-semibold">
              {recommendationFilter === "scale" ? "✓ Filtro ativo (clique para limpar)" : "Filtrar escaláveis →"}
            </div>
          </div>

          {/* Criativos Sugeridos para Pausar */}
          <div
            onClick={() => setRecommendationFilter(recommendationFilter === "pause" ? "all" : "pause")}
            className={`bg-white dark:bg-[#081A33] border rounded-xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:border-rose-400 ${
              recommendationFilter === "pause"
                ? "border-rose-500 ring-2 ring-rose-500/20"
                : "border-slate-200/90 dark:border-[#142C52]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Sugeridos para Pausar
              </span>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold rounded-full">
                Prejuízo / Dreno
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {pauseCount}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">anúncios</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Sem vendas após gasto relevante ou gerando prejuízo
              </p>
            </div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-2 pt-2 border-t border-slate-100 dark:border-[#142C52]/60 font-semibold">
              {recommendationFilter === "pause" ? "✓ Filtro ativo (clique para limpar)" : "Filtrar prejuízos →"}
            </div>
          </div>
        </div>
      )}

      {/* Container Principal da Tabela */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Barra de Filtros e Ações da Tabela */}
        <div className="p-4 border-b border-slate-200 dark:border-[#142C52] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Buscar ${levelTitle.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-xs w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg font-medium text-slate-700 dark:text-slate-300"
              >
                <option value="all">Todos os Status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="PAUSED">Pausado</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de Colunas */}
            <div className="relative">
              <button
                onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#142C52]/60 font-semibold"
              >
                <Columns className="w-3.5 h-3.5" /> Colunas
              </button>
              {isColumnPickerOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-52 p-2.5 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-xl shadow-xl space-y-1.5 animate-in fade-in">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Exibir Colunas
                  </p>
                  {Object.keys(visibleColumns).map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col]}
                        onChange={(e) =>
                          setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {col === "netRevenue"
                        ? "Líquido Real"
                        : col === "recommendation"
                        ? "Recomendação"
                        : col === "actions"
                        ? "Ações de Gestão"
                        : col}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Exportar CSV */}
            <button
              onClick={exportCSV}
              disabled={sortedItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#142C52]/60 font-semibold disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 bg-slate-50 dark:bg-[#061224] border border-slate-200 dark:border-[#142C52] rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              title="Atualizar tabela"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Barra de Ações em Massa (Bulk Actions) quando há seleção */}
        {selectedRowIds.length > 0 && (
          <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-900 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-900 dark:text-blue-200">
                {selectedRowIds.length} {selectedRowIds.length === 1 ? "selecionado" : "selecionados"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkStatus("PAUSED")}
                disabled={manageMutation.isPending}
                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors"
                title="Pausar todos os itens selecionados na Meta"
              >
                <Pause className="w-3 h-3" /> Pausar Selecionados
              </button>
              <button
                onClick={() => handleBulkStatus("ACTIVE")}
                disabled={manageMutation.isPending}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors"
                title="Ativar todos os itens selecionados na Meta"
              >
                <Play className="w-3 h-3" /> Ativar Selecionados
              </button>
              {level !== "ad" && (
                <button
                  onClick={() => handleBulkBudgetScale(20)}
                  disabled={manageMutation.isPending}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors"
                  title="Escala horizontal: Aumentar orçamento diário em +20%"
                >
                  <TrendingUp className="w-3 h-3" /> +20% Verba
                </button>
              )}
              <button
                onClick={handleBulkDuplicate}
                disabled={duplicateMutation.isPending}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-colors"
                title="Duplicar todos os itens selecionados (criados como pausados)"
              >
                <Copy className="w-3 h-3" /> Duplicar Selecionados
              </button>
              <button
                onClick={() => setSelectedRowIds([])}
                className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs hover:bg-slate-300"
              >
                ✕ Desmarcar
              </button>
            </div>
          </div>
        )}

        {/* Barra de Filtros de Recomendação Rápida (quando level === 'ad') */}
        {level === "ad" && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-[#142C52]/60 bg-slate-50/60 dark:bg-[#061224]/50 text-xs">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Filtrar Ação:</span>
            {[
              { key: "all", label: `Todos (${items.length})` },
              { key: "scale", label: `🚀 Escalar (${scaleCount})` },
              { key: "profitable", label: `🟢 Lucrativos (${profitableCount})` },
              { key: "breakeven", label: `🟡 Atenção (${breakevenCount})` },
              { key: "pause", label: `🔴 Pausar (${pauseCount})` },
              { key: "learning", label: `🧪 Em Teste (${learningCount})` },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setRecommendationFilter(btn.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  recommendationFilter === btn.key
                    ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-xs border border-slate-200 dark:border-blue-500"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#142C52]/40"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Tabela de Dados */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#061224] border-b border-slate-200 dark:border-[#142C52] text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-tight select-none">
                {/* Checkbox Select All */}
                <th className="p-3 w-8 text-center">
                  <button onClick={toggleSelectAll} className="p-0.5 text-slate-400 hover:text-slate-600">
                    {selectedRowIds.length === sortedItems.length && sortedItems.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>

                {visibleColumns.status && <th className="p-3 w-28">Status / Ação</th>}

                {visibleColumns.recommendation && (
                  <th
                    onClick={() => handleSort("recommendation")}
                    className="p-3 cursor-pointer hover:text-blue-600 min-w-[120px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Recomendação</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.name && (
                  <th
                    onClick={() => handleSort("name")}
                    className="p-3 cursor-pointer hover:text-blue-600 min-w-[220px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>{levelTitle}</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.budget && (
                  <th onClick={() => handleSort("budget")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Orçamento</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.spend && (
                  <th onClick={() => handleSort("spend")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Gastos</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.sales && (
                  <th onClick={() => handleSort("sales")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Vendas</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.cpa && (
                  <th onClick={() => handleSort("cpa")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>CPA</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.revenue && (
                  <th onClick={() => handleSort("revenue")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Faturamento</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.netRevenue && (
                  <th onClick={() => handleSort("netRevenue")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Líquido Real</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.profit && (
                  <th onClick={() => handleSort("profit")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Lucro Líquido</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.roas && (
                  <th onClick={() => handleSort("roas")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>ROAS Real</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.roi && (
                  <th onClick={() => handleSort("roi")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>ROI</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.impressions && (
                  <th onClick={() => handleSort("impressions")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Impressões</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.margin && (
                  <th onClick={() => handleSort("margin")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Margem</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.cpm && (
                  <th onClick={() => handleSort("cpm")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>CPM</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.clicks && (
                  <th onClick={() => handleSort("clicks")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>Cliques</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.cpc && (
                  <th onClick={() => handleSort("cpc")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>CPC</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.ctr && (
                  <th onClick={() => handleSort("ctr")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>CTR</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.ic && (
                  <th onClick={() => handleSort("ic")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>IC</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.cpi && (
                  <th onClick={() => handleSort("cpi")} className="p-3 text-right cursor-pointer hover:text-blue-600">
                    <div className="flex items-center justify-end gap-1">
                      <span>CPI</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                )}

                {visibleColumns.actions && (
                  <th className="p-3 text-center w-24 sticky right-0 bg-slate-50 dark:bg-[#061224] shadow-sm">
                    Ações
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-[#142C52]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={23} className="p-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Carregando métricas reais da Meta...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={23} className="p-8 text-center text-slate-400">
                    Nenhum item encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const isSelected = selectedRowIds.includes(item.id);
                  const isActive = item.status?.toUpperCase() === "ACTIVE";

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-[#061224]/70 transition-colors ${
                        isSelected ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button onClick={() => toggleRow(item.id)} className="p-0.5 text-slate-400 hover:text-slate-600">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Status Toggle Switch Interativo */}
                      {visibleColumns.status && (
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleToggleStatus(item)}
                              disabled={manageMutation.isPending}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                              }`}
                              title={isActive ? "Clique para pausar no Facebook" : "Clique para ativar no Facebook"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  isActive ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span
                              className={`text-[10px] font-bold ${
                                isActive
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {isActive ? "Ativo" : "Pausado"}
                            </span>
                          </div>
                        </td>
                      )}

                      {visibleColumns.recommendation && (
                        <td className="p-3">
                          {getRecommendationBadge(item.recommendation)}
                        </td>
                      )}

                      {/* Nome com botão de renomear inline */}
                      {visibleColumns.name && (
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 max-w-xs group">
                          <div className="flex items-center gap-1.5">
                            <span title={item.name} className="truncate">{item.name}</span>
                            <button
                              onClick={() => setEditingName({ id: item.id, name: item.name })}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity"
                              title="Renomear"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                          {item.parentName && (
                            <div className="text-[10px] text-slate-400 truncate">
                              {item.parentName}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Orçamento com edição inline */}
                      {visibleColumns.budget && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300 group">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{item.budget ? formatCurrency(item.budget) : "—"}</span>
                            <button
                              onClick={() =>
                                setEditingBudget({
                                  id: item.id,
                                  name: item.name,
                                  budget: item.budget || 50,
                                })
                              }
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity"
                              title="Editar orçamento no Facebook"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}

                      {visibleColumns.spend && (
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.spend)}
                        </td>
                      )}

                      {visibleColumns.sales && (
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-200">
                          <div className="font-semibold">{formatNumber(item.sales)}</div>
                          {item.realSalesCount !== undefined && item.realSalesCount > 0 && (
                            <div className="text-[9px] text-emerald-600 dark:text-emerald-400">
                              ✓ {item.realSalesCount} banco
                            </div>
                          )}
                        </td>
                      )}

                      {visibleColumns.cpa && (
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-200">
                          {item.cpa ? formatCurrency(item.cpa) : "—"}
                        </td>
                      )}

                      {visibleColumns.revenue && (
                        <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(item.revenue)}
                        </td>
                      )}

                      {visibleColumns.netRevenue && (
                        <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.netRevenue ?? (item.revenue * 0.9))}
                        </td>
                      )}

                      {visibleColumns.profit && (
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            item.profit >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {formatCurrency(item.profit)}
                        </td>
                      )}

                      {visibleColumns.roas && (
                        <td className="p-3 text-right font-mono">
                          <div className="text-purple-600 dark:text-purple-400 font-bold">
                            {formatMetric(item.roas, "ratio")}
                          </div>
                          {item.grossRoas !== undefined && item.grossRoas !== null && item.grossRoas !== item.roas && (
                            <div className="text-[9px] text-slate-400 font-normal">
                              Bruto: {formatMetric(item.grossRoas, "ratio")}
                            </div>
                          )}
                        </td>
                      )}

                      {visibleColumns.roi && (
                        <td
                          className={`p-3 text-right font-mono font-semibold ${
                            (item.roi || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                          }`}
                        >
                          {formatPercent(item.roi || 0)}
                        </td>
                      )}

                      {visibleColumns.impressions && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatNumber(item.impressions)}
                        </td>
                      )}

                      {visibleColumns.margin && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatPercent(item.margin || 0)}
                        </td>
                      )}

                      {visibleColumns.cpm && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {item.cpm ? formatCurrency(item.cpm) : "—"}
                        </td>
                      )}

                      {visibleColumns.clicks && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatNumber(item.clicks)}
                        </td>
                      )}

                      {visibleColumns.cpc && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {item.cpc ? formatCurrency(item.cpc) : "—"}
                        </td>
                      )}

                      {visibleColumns.ctr && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatPercent(item.ctr || 0)}
                        </td>
                      )}

                      {visibleColumns.ic && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatNumber(item.ic)}
                        </td>
                      )}

                      {visibleColumns.cpi && (
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {item.cpi ? formatCurrency(item.cpi) : "—"}
                        </td>
                      )}

                      {/* Coluna Ações: Duplicar e Editar */}
                      {visibleColumns.actions && (
                        <td className="p-3 text-center sticky right-0 bg-white/95 dark:bg-[#081A33]/95 shadow-sm">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => duplicateMutation.mutate({ level, id: item.id })}
                              disabled={duplicateMutation.isPending}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors"
                              title="Duplicar como Pausado (na Meta e no Sistema)"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingName({ id: item.id, name: item.name })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                              title="Renomear"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Footer de Totalização */}
            {sortedItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 dark:bg-[#061224] border-t-2 border-slate-300 dark:border-[#142C52] font-bold text-slate-900 dark:text-white">
                  <td className="p-3 text-center font-mono">Σ</td>
                  {visibleColumns.status && <td className="p-3">—</td>}
                  {visibleColumns.recommendation && <td className="p-3">—</td>}
                  {visibleColumns.name && <td className="p-3">Total ({sortedItems.length})</td>}
                  {visibleColumns.budget && <td className="p-3 text-right font-mono">—</td>}
                  {visibleColumns.spend && <td className="p-3 text-right font-mono">{formatCurrency(totals.spend)}</td>}
                  {visibleColumns.sales && <td className="p-3 text-right font-mono">{formatNumber(totals.sales)}</td>}
                  {visibleColumns.cpa && <td className="p-3 text-right font-mono">{totalCpa ? formatCurrency(totalCpa) : "—"}</td>}
                  {visibleColumns.revenue && <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(totals.revenue)}</td>}
                  {visibleColumns.netRevenue && <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.netRevenue)}</td>}
                  {visibleColumns.profit && (
                    <td
                      className={`p-3 text-right font-mono ${
                        totals.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(totals.profit)}
                    </td>
                  )}
                  {visibleColumns.roas && (
                    <td className="p-3 text-right font-mono text-purple-600 dark:text-purple-400">
                      {formatMetric(totalRoas, "ratio")}
                    </td>
                  )}
                  {visibleColumns.roi && <td className="p-3 text-right font-mono">{formatPercent(totalRoi || 0)}</td>}
                  {visibleColumns.impressions && <td className="p-3 text-right font-mono">{formatNumber(totals.impressions)}</td>}
                  {visibleColumns.margin && <td className="p-3 text-right font-mono">{formatPercent(totalMargin || 0)}</td>}
                  {visibleColumns.cpm && <td className="p-3 text-right font-mono">{totalCpm ? formatCurrency(totalCpm) : "—"}</td>}
                  {visibleColumns.clicks && <td className="p-3 text-right font-mono">{formatNumber(totals.clicks)}</td>}
                  {visibleColumns.cpc && <td className="p-3 text-right font-mono">{totalCpc ? formatCurrency(totalCpc) : "—"}</td>}
                  {visibleColumns.ctr && <td className="p-3 text-right font-mono">{formatPercent(totalCtr || 0)}</td>}
                  {visibleColumns.ic && <td className="p-3 text-right font-mono">{formatNumber(totals.ic)}</td>}
                  {visibleColumns.cpi && <td className="p-3 text-right font-mono">{totalCpi ? formatCurrency(totalCpi) : "—"}</td>}
                  {visibleColumns.actions && <td className="p-3 text-center">—</td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Editar Orçamento */}
      {editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-slate-200 dark:border-[#142C52] animate-in fade-in">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Alterar Orçamento Diário
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={editingBudget.name}>
                {editingBudget.name}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Novo Orçamento Diário (R$)
              </label>
              <input
                type="number"
                step="5"
                min="5"
                value={editingBudget.budget}
                onChange={(e) =>
                  setEditingBudget({ ...editingBudget, budget: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-sm font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Presets Rápidos de Escala */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "+20% Escala", factor: 1.2 },
                { label: "+50%", factor: 1.5 },
                { label: "-20%", factor: 0.8 },
                { label: "-50%", factor: 0.5 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setEditingBudget({
                      ...editingBudget,
                      budget: Math.round(editingBudget.budget * p.factor),
                    })
                  }
                  className="px-2.5 py-1 bg-slate-100 dark:bg-[#142C52] hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 rounded-lg text-[11px] font-semibold transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingBudget(null)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 dark:border-[#142C52] rounded-xl hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  manageMutation.mutate({
                    level,
                    id: editingBudget.id,
                    budget: editingBudget.budget,
                  })
                }
                disabled={manageMutation.isPending}
                className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow disabled:opacity-50"
              >
                {manageMutation.isPending ? "Salvando na Meta..." : "Salvar no Facebook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Nome */}
      {editingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-[#081A33] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 border border-slate-200 dark:border-[#142C52] animate-in fade-in">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Renomear {levelTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                O novo nome será sincronizado diretamente na sua conta da Meta.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={editingName.name}
                onChange={(e) =>
                  setEditingName({ ...editingName, name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#142C52] bg-slate-50 dark:bg-[#061224] text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingName(null)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 dark:border-[#142C52] rounded-xl hover:bg-slate-50 dark:hover:bg-[#142C52] text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  manageMutation.mutate({
                    level,
                    id: editingName.id,
                    name: editingName.name,
                  })
                }
                disabled={manageMutation.isPending || !editingName.name.trim()}
                className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow disabled:opacity-50"
              >
                {manageMutation.isPending ? "Salvando..." : "Salvar Nome"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
