"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface HourlyPoint {
  hour: string;
  grossRevenue: number;
  netRevenue: number;
  spend: number;
  profit: number;
  cumulativeGross: number;
  cumulativeSpend: number;
  cumulativeProfit: number;
}

interface HourlyRevenueChartProps {
  data?: HourlyPoint[];
  loading?: boolean;
}

export function HourlyRevenueChart({ data = [], loading = false }: HourlyRevenueChartProps) {
  const [isCumulative, setIsCumulative] = useState(true);
  const [revenueType, setRevenueType] = useState<"gross" | "net">("gross");

  const formattedData = data.map((d) => ({
    hour: d.hour,
    faturamento: isCumulative
      ? revenueType === "gross"
        ? d.cumulativeGross
        : d.cumulativeGross * 0.95
      : revenueType === "gross"
      ? d.grossRevenue
      : d.netRevenue,
    investimento: isCumulative ? d.cumulativeSpend : d.spend,
    lucro: isCumulative ? d.cumulativeProfit : d.profit,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 dark:bg-black/95 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5">
          <p className="font-bold text-white mb-1 border-b border-slate-800 pb-1">
            Horário: {label} {isCumulative ? "(Acumulado)" : ""}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(entry.value || 0)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Faturamento x Investimento x Lucro por Hora
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evolução temporal das receitas e custos operacionais
          </p>
        </div>

        {/* Controles do Gráfico */}
        <div className="flex items-center gap-2">
          {/* Toggle Bruto/Líquido */}
          <div className="flex items-center bg-slate-100 dark:bg-[#060E1C] p-1 rounded-lg border border-slate-200 dark:border-[#142C52]">
            <button
              onClick={() => setRevenueType("gross")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                revenueType === "gross"
                  ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Bruto
            </button>
            <button
              onClick={() => setRevenueType("net")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                revenueType === "net"
                  ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Líquido
            </button>
          </div>

          {/* Toggle Acumulado/Hora a Hora */}
          <div className="flex items-center bg-slate-100 dark:bg-[#060E1C] p-1 rounded-lg border border-slate-200 dark:border-[#142C52]">
            <button
              onClick={() => setIsCumulative(true)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                isCumulative
                  ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Acumulado
            </button>
            <button
              onClick={() => setIsCumulative(false)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                !isCumulative
                  ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Por Hora
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-50 dark:bg-[#060E1C] rounded-xl animate-pulse">
          <span className="text-xs text-slate-400">Carregando métricas temporais...</span>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0066FF" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={{ stroke: "#cbd5e1", opacity: 0.3 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(val) => `R$ ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                axisLine={{ stroke: "#cbd5e1", opacity: 0.3 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Area
                type="monotone"
                dataKey="faturamento"
                name={revenueType === "gross" ? "Faturamento Bruto" : "Faturamento Líquido"}
                stroke="#0066FF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorFat)"
              />
              <Area
                type="monotone"
                dataKey="investimento"
                name="Investimento Anúncios"
                stroke="#F97316"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInv)"
              />
              <Area
                type="monotone"
                dataKey="lucro"
                name="Lucro Real"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLucro)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
