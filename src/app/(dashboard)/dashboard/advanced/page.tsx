"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ArrowUpDown } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { getDateRange, formatCurrency, formatMetric, formatNumber } from "@/lib/utils";

type AdvancedRow = {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  checkouts: number;
  cpi: number | null;
  purchases: number;
  cpa: number | null;
  revenue: number;
  profit: number;
  roas: number | null;
  roi: number | null;
  margin: number | null;
  adSetsCount: number;
  adsCount: number;
};

export default function AdvancedDashboardPage() {
  const [period, setPeriod] = useState({
    preset: "Últimos 30 dias",
    ...getDateRange("last30days"),
  });
  const [sortField, setSortField] = useState<keyof AdvancedRow>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const { data, isLoading } = useQuery<{ campaigns: AdvancedRow[] }>({
    queryKey: ["advanced-dashboard", period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/advanced?from=${period.from.toISOString()}&to=${period.to.toISOString()}`
      );
      if (!res.ok) throw new Error("Erro ao buscar métricas");
      return res.json();
    },
  });

  const campaigns = data?.campaigns || [];

  const handleSort = (field: keyof AdvancedRow) => {
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Avançado</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visão completa do funil de marketing e finanças por campanha: Tráfego → Conversão → Lucro
          </p>
        </div>
        <PeriodSelector
          value={period.preset}
          onChange={(preset, from, to) => setPeriod({ preset, from, to, label: preset })}
        />
      </div>

      {/* Advanced Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-sm text-gray-900 dark:text-white">Desempenho por Campanha</h2>
          </div>
          <span className="text-xs text-gray-500">{campaigns.length} campanhas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400">
                <th onClick={() => handleSort("name")} className="py-3 px-3 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center gap-1">Campanha <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("spend")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Gasto <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("impressions")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Impressões <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("clicks")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Cliques <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("ctr")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">CTR <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("cpc")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">CPC <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("checkouts")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Checkouts <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("cpi")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">CPI <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort("purchases")} className="py-3 px-3 text-right cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  <div className="flex items-center justify-end gap-1">Compras <ArrowUpDown className="w-3 h-3" /></div>
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td colSpan={15} className="py-3.5 px-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="font-medium">Nenhuma campanha encontrada</p>
                    <p className="text-xs mt-1">Sincronize o Meta Ads para popular esta tabela.</p>
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white max-w-[180px] truncate" title={row.name}>
                      {row.name}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(row.spend)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 font-mono">{formatNumber(row.impressions)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 font-mono">{formatNumber(row.clicks)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.ctr, "percent")}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.cpc, "currency")}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400 font-mono">{row.checkouts}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.cpi, "currency")}</td>
                    <td className="py-3 px-3 text-right font-medium text-gray-900 dark:text-white">{row.purchases}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.cpa, "currency")}</td>
                    <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(row.revenue)}</td>
                    <td className={`py-3 px-3 text-right font-semibold ${row.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-blue-600 dark:text-blue-400">{formatMetric(row.roas, "ratio")}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.roi, "percent")}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.margin, "percent")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
