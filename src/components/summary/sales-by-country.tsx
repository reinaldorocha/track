"use client";

import React, { useState } from "react";
import { Globe, Trophy, MapPin } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

interface CountryPoint {
  country: string;
  code: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface SalesByCountryProps {
  data?: CountryPoint[];
  loading?: boolean;
}

export function SalesByCountry({ data = [], loading = false }: SalesByCountryProps) {
  const [viewMode, setViewMode] = useState<"ranking" | "map">("ranking");

  // Bandeiras por código
  const flagMap: Record<string, string> = {
    BR: "🇧🇷",
    US: "🇺🇸",
    PT: "🇵🇹",
    ES: "🇪🇸",
    AR: "🇦🇷",
    CL: "🇨🇱",
    UY: "🇺🇾",
    PY: "🇵🇾",
    MX: "🇲🇽",
    CO: "🇨🇴",
    UK: "🇬🇧",
    FR: "🇫🇷",
    DE: "🇩🇪",
    IT: "🇮🇹",
  };

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Vendas por País
          </h3>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-[#060E1C] p-1 rounded-lg border border-slate-200 dark:border-[#142C52]">
          <button
            onClick={() => setViewMode("ranking")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              viewMode === "ranking"
                ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <Trophy className="w-3 h-3" /> Ranking
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              viewMode === "map"
                ? "bg-white dark:bg-[#142C52] text-blue-600 dark:text-blue-300 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            <MapPin className="w-3 h-3" /> Mapa
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Nenhuma venda registrada com localização no período
        </div>
      ) : viewMode === "ranking" ? (
        <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
          {data.map((item, index) => (
            <div
              key={`${item.country || item.code || 'country'}-${index}`}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-100 dark:border-[#142C52]/60 hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold text-slate-400 w-4">
                  #{index + 1}
                </span>
                <span className="text-lg">{flagMap[item.code] || "🌐"}</span>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.country}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatNumber(item.count)} venda(s)
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                  {formatCurrency(item.revenue)}
                </p>
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {formatPercent(item.percentage)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Visualização do Mapa / Resumo Geográfico */
        <div className="p-4 bg-slate-50 dark:bg-[#061224] rounded-xl border border-slate-200 dark:border-[#142C52] text-center space-y-2">
          <div className="text-3xl">🗺️</div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Distribuição Global
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {data.map((item, index) => (
              <span
                key={`${item.country || item.code || 'country'}-${index}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-[#081A33] border border-slate-200 dark:border-[#142C52] rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                <span>{flagMap[item.code] || "🌐"}</span>
                <span>{item.country}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {formatPercent(item.percentage)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
