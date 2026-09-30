"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface HourlyPoint {
  hour: string;
  profit: number;
  grossRevenue: number;
  netRevenue: number;
  spend: number;
}

interface HourlyProfitChartProps {
  data?: HourlyPoint[];
  loading?: boolean;
}

export function HourlyProfitChart({ data = [], loading = false }: HourlyProfitChartProps) {
  const [filterType, setFilterType] = useState<"liquid" | "gross">("liquid");

  const formattedData = data.map((d) => {
    const val = filterType === "liquid" ? d.profit : d.grossRevenue - d.spend;
    return {
      hour: d.hour,
      lucro: val,
      receita: filterType === "liquid" ? d.netRevenue : d.grossRevenue,
      gasto: d.spend,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value || 0;
      const isPositive = val >= 0;
      return (
        <div className="bg-slate-900 dark:bg-black/95 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-bold text-white mb-1 border-b border-slate-800 pb-1">
            Horário: {label}
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300">Lucro no Horário:</span>
            <span
              className={`font-mono font-bold ${
                isPositive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatCurrency(val)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
            <span>Receita:</span>
            <span className="font-mono">{formatCurrency(payload[0].payload.receita || 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
            <span>Investimento:</span>
            <span className="font-mono">{formatCurrency(payload[0].payload.gasto || 0)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Lucro por Horário (00:00 às 23:00)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Rentabilidade líquida distribuída pelas horas do dia
          </p>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-[#060E1C] p-1 rounded-lg border border-slate-200 dark:border-[#142C52]">
          <button
            onClick={() => setFilterType("liquid")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              filterType === "liquid"
                ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            Líquido
          </button>
          <button
            onClick={() => setFilterType("gross")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              filterType === "gross"
                ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            Bruto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center bg-slate-50 dark:bg-[#060E1C] rounded-xl animate-pulse">
          <span className="text-xs text-slate-400">Carregando lucros horários...</span>
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#cbd5e1", opacity: 0.3 }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(val) => `R$ ${val}`}
                axisLine={{ stroke: "#cbd5e1", opacity: 0.3 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
              <Bar dataKey="lucro" radius={[4, 4, 0, 0]}>
                {formattedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.lucro >= 0 ? "#10B981" : "#F43F5E"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
