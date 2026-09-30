"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { getDateRange, formatCurrency, formatMetric } from "@/lib/utils";
import { HourlySalesBreakdown } from "@/components/sales/hourly-sales-breakdown";

type ReportRow = {
  item: string;
  sales: number;
  revenue: number;
  spend: number;
  profit: number;
  cpa: number | null;
  roas: number | null;
  margin: number | null;
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState<"campaign" | "platform" | "utm" | "hourly">("campaign");
  const [period, setPeriod] = useState({
    preset: "Últimos 30 dias",
    ...getDateRange("last30days"),
  });

  const { data, isLoading, refetch, isFetching } = useQuery<{ report: ReportRow[] }>({
    queryKey: ["reports", reportType, period.from.toISOString(), period.to.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports?type=${reportType}&from=${period.from.toISOString()}&to=${period.to.toISOString()}`
      );
      if (!res.ok) throw new Error("Erro ao carregar relatório");
      return res.json();
    },
  });

  const report = data?.report || [];

  const handleExportCSV = () => {
    const url = `/api/reports?type=${reportType}&from=${period.from.toISOString()}&to=${period.to.toISOString()}&format=csv`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Central de Relatórios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gere relatórios analíticos consolidados e exporte planilhas em formato CSV
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            value={period.preset}
            onChange={(preset, from, to) => setPeriod({ preset, from, to, label: preset })}
          />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 shadow"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 text-sm">
        <button
          onClick={() => setReportType("campaign")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === "campaign"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Por Campanha
        </button>
        <button
          onClick={() => setReportType("platform")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === "platform"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Por Plataforma de Checkout
        </button>
        <button
          onClick={() => setReportType("utm")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === "utm"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Por UTM Campaign
        </button>
        <button
          onClick={() => setReportType("hourly")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            reportType === "hourly"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          ⏰ Por Hora do Dia (24h)
        </button>
      </div>

      {/* Content */}
      {reportType === "hourly" ? (
        <HourlySalesBreakdown />
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Relatório Consolidado ({reportType.toUpperCase()})
              </h2>
            </div>
            <button onClick={() => refetch()} className="text-gray-400 hover:text-blue-600 p-1">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 text-xs">
                  <th className="py-3 px-4">Item / Agrupamento</th>
                  <th className="py-3 px-3 text-right">Vendas</th>
                  <th className="py-3 px-3 text-right">Faturamento</th>
                  <th className="py-3 px-3 text-right">Investimento</th>
                  <th className="py-3 px-3 text-right">Lucro Líquido</th>
                  <th className="py-3 px-3 text-right">CPA</th>
                  <th className="py-3 px-3 text-right">ROAS</th>
                  <th className="py-3 px-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td colSpan={8} className="py-3.5 px-4">
                        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : report.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500 dark:text-gray-400">
                      <FileSpreadsheet className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="font-medium">Nenhum dado encontrado para o período</p>
                    </td>
                  </tr>
                ) : (
                  report.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white max-w-[250px] truncate" title={row.item}>
                        {row.item}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-gray-900 dark:text-white">{row.sales}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(row.revenue)}</td>
                      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(row.spend)}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${row.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(row.profit)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.cpa, "currency")}</td>
                      <td className="py-3 px-3 text-right font-medium text-blue-600 dark:text-blue-400">{formatMetric(row.roas, "ratio")}</td>
                      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">{formatMetric(row.margin, "percent")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
