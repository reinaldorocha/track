"use client";

import React from "react";
import { Info } from "lucide-react";

interface SummaryKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  icon?: React.ReactNode;
  variant?: "default" | "positive" | "negative" | "neutral" | "warning";
  loading?: boolean;
}

export function SummaryKpiCard({
  title,
  value,
  subtitle,
  tooltip,
  icon,
  variant = "default",
  loading = false,
}: SummaryKpiCardProps) {
  let valueColor = "text-slate-900 dark:text-white";
  if (variant === "positive") {
    valueColor = "text-emerald-600 dark:text-emerald-400";
  } else if (variant === "negative") {
    valueColor = "text-rose-600 dark:text-rose-400";
  } else if (variant === "warning") {
    valueColor = "text-amber-600 dark:text-amber-400";
  }

  return (
    <div className="bg-white dark:bg-[#081A33] border border-slate-200/90 dark:border-[#142C52] rounded-xl p-4 shadow-sm hover:shadow transition-all relative group flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight">
            {title}
          </span>
          {tooltip && (
            <div className="relative inline-flex items-center">
              <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 w-48 p-2 text-[11px] leading-tight text-white bg-slate-900 dark:bg-black rounded-lg shadow-xl pointer-events-none text-center">
                {tooltip}
              </div>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#040A14] text-slate-500 dark:text-slate-400">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-1">
        {loading ? (
          <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        ) : (
          <div className={`text-xl font-bold tracking-tight ${valueColor}`}>
            {value}
          </div>
        )}

        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
