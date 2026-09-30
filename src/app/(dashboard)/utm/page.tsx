"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Link2, Plus, ArrowUpDown, ChevronRight } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { getDateRange, formatCurrency, formatMetric } from "@/lib/utils";

type UtmRow = {
  campaign: string;
  sessions: number;
  sales: number;
  approvedSales: number;
  spend: number;
  revenue: number;
  profit: number;
  cpa: number | null;
  roas: number | null;
  roi: number | null;
  margin: number | null;
};

export default function UTMPage() {
  const [period, setPeriod] = useState({
    preset: "Últimos 30 dias",
    ...getDateRange("last30days"),
  });
  const [sortField, setSortField] = useState<keyof UtmRow>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<UtmRow | null>(null);

  const { data, isLoading } = useQuery<{ campaigns: UtmRow[] }>({
    queryKey: ["utm-campaigns", period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/utm/campaigns?from=${period.from.toISOString()}&to=${period.to.toISOString()}`
      );
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
  });

  const campaigns = data?.campaigns || [];

  const handleSort = (field: keyof UtmRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const valA = a[sortField] ?? -Infinity;
    const valB = b[sortField] ?? -Infinity;
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const totalRevenue = campaigns.reduce((acc, c) => acc + c.revenue, 0);
  const totalSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
  const totalSales = campaigns.reduce((acc, c) => acc + c.sales, 0);
  const totalProfit = campaigns.reduce((acc, c) => acc + c.profit, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard por UTM</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Performance consolidada de faturamento, gasto e lucro por parâmetro <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">utm_campaign</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            value={period.preset}
            onChange={(preset, from, to) => setPeriod({ preset, from, to, label: preset })}
          />
          <Link
            href="/integrations/utm"
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-gray-700 transition-colors"
          >
            ⚙️ Configurar Rastreamento
          </Link>
          <Link
            href="/integrations/utm"
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 shadow"
          >
            <Plus className="w-4 h-4" /> Criar Link UTM
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Faturamento via UTM</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Investimento Atribuído</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total de Pedidos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalSales}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Lucro Líquido</p>
          <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(totalProfit)}
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-base text-gray-900 dark:text-white">Campanhas Rastreadas</h2>
          <span className="text-xs text-gray-500">{campaigns.length} identificadas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 text-xs">
                <th onClick={() => handleSort("campaign")} className="py-3 px-4 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center gap-1">UTM Campaign <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("sessions")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Sessões <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("sales")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Vendas <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("spend")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Investimento <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("cpa")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">CPA <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("revenue")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Faturamento <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("profit")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Lucro <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("roas")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">ROAS <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("roi")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">ROI <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("margin")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Margem <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="py-3 px-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td colSpan={11} className="py-3 px-4">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <Link2 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="font-medium">Nenhum dado de UTM no período selecionado</p>
                    <p className="text-xs mt-1">Crie links rastreáveis e instale o tracker para visualizar dados aqui.</p>
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((row) => (
                  <tr
                    key={row.campaign}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={row.campaign}>
                      {row.campaign}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 font-mono text-xs">{row.sessions}</td>
                    <td className="py-3 px-3 text-right font-medium text-gray-900 dark:text-white">{row.sales}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(row.spend)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.cpa, "currency")}</td>
                    <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(row.revenue)}</td>
                    <td className={`py-3 px-3 text-right font-semibold ${row.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-blue-600 dark:text-blue-400">{formatMetric(row.roas, "ratio")}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.roi, "percent")}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.margin, "percent")}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedCampaign(row)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Ver Detalhes"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes da Campanha */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate" title={selectedCampaign.campaign}>
                {selectedCampaign.campaign}
              </h3>
              <button onClick={() => setSelectedCampaign(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500">Faturamento Bruto</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(selectedCampaign.revenue)}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500">Investimento (Gasto)</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(selectedCampaign.spend)}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500">Lucro Líquido</p>
                <p className={`text-base font-bold mt-1 ${selectedCampaign.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(selectedCampaign.profit)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500">ROAS</p>
                <p className="text-base font-bold text-blue-600 mt-1">{formatMetric(selectedCampaign.roas, "ratio")}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500">Vendas Aprovadas</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{selectedCampaign.approvedSales} de {selectedCampaign.sales}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-500">CPA Médio</p>
                <p className="text-base font-bold text-gray-900 dark:text-white mt-1">{formatMetric(selectedCampaign.cpa, "currency")}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedCampaign(null)}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-800 dark:text-gray-200 py-2 rounded-lg text-sm font-medium"
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
