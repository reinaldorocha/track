"use client";

import React from "react";
import { Link2, Layers } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

interface DistributionItem {
  name?: string;
  source?: string;
  platform?: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface SourceDistributionProps {
  sources?: DistributionItem[];
  platforms?: DistributionItem[];
  loading?: boolean;
}

export function SourceDistributionCard({
  sources = [],
  platforms = [],
  loading = false,
}: SourceDistributionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Vendas por Fonte de Tráfego / UTM Source */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Vendas por Fonte de Tráfego (UTM)
          </h3>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nenhuma origem rastreada no período
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {sources.map((item, index) => {
              const displayName = item.name || item.source || "Origem";
              return (
                <div
                  key={`${displayName}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-100 dark:border-[#142C52]/60 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-slate-400">{formatNumber(item.count)} venda(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.revenue)}
                    </p>
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                      {formatPercent(item.percentage)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vendas por Plataforma de Checkout */}
      <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Vendas por Plataforma (Checkout)
          </h3>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
            ))}
          </div>
        ) : platforms.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nenhum pedido de checkout registrado no período
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {platforms.map((item, index) => {
              const displayName = item.name || item.platform || "Plataforma";
              return (
                <div
                  key={`${displayName}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-100 dark:border-[#142C52]/60 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-slate-400">{formatNumber(item.count)} venda(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.revenue)}
                    </p>
                    <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatPercent(item.percentage)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
