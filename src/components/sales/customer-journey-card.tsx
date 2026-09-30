"use client";

import React from "react";
import {
  Target,
  Eye,
  UserCheck,
  ShoppingCart,
  QrCode,
  CheckCircle2,
  RotateCcw,
  Clock,
  Sparkles,
  Smartphone,
  Laptop,
  Globe,
  Calendar,
  ChevronRight,
  Layers,
  AlertOctagon,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export type Touchpoint = {
  id: string;
  timestamp: string;
  type:
    | "ad_click"
    | "session_start"
    | "page_view"
    | "lead"
    | "initiate_checkout"
    | "pix_generated"
    | "purchase_approved"
    | "refund"
    | "chargeback";
  title: string;
  description?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  url?: string;
  device?: string;
  referrer?: string;
  isConversion?: boolean;
  metadata?: Record<string, unknown>;
};

export type JourneyData = {
  saleId: string;
  visitorId?: string | null;
  sessionId?: string | null;
  touchpoints: Touchpoint[];
  summary: {
    firstTouch?: {
      timestamp: string;
      source: string;
      campaign?: string;
      type: string;
    } | null;
    lastTouch?: {
      timestamp: string;
      source: string;
      campaign?: string;
      type: string;
    } | null;
    totalTouchpoints: number;
    timeToConvertFormatted: string;
    timeToConvertSeconds: number;
    pathPreview: string[];
  };
};

export function CustomerJourneyCard({ journey }: { journey?: JourneyData | null }) {
  if (!journey || !journey.touchpoints || journey.touchpoints.length === 0) {
    return (
      <div className="p-6 bg-white dark:bg-[#081A33] rounded-2xl border border-slate-200 dark:border-[#142C52] text-center space-y-2">
        <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          Jornada Multi-Touch
        </h3>
        <p className="text-xs text-slate-400">
          Nenhum ponto de contato adicional registrado para esta venda além do checkout direto.
        </p>
      </div>
    );
  }

  const { touchpoints, summary } = journey;

  const getTouchpointIcon = (type: Touchpoint["type"]) => {
    switch (type) {
      case "ad_click":
        return <Target className="w-4 h-4 text-orange-500" />;
      case "session_start":
        return <Globe className="w-4 h-4 text-blue-500" />;
      case "page_view":
        return <Eye className="w-4 h-4 text-purple-500" />;
      case "lead":
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case "initiate_checkout":
        return <ShoppingCart className="w-4 h-4 text-amber-500" />;
      case "pix_generated":
        return <QrCode className="w-4 h-4 text-sky-500" />;
      case "purchase_approved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "refund":
        return <RotateCcw className="w-4 h-4 text-rose-500" />;
      case "chargeback":
        return <AlertOctagon className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getBadgeStyle = (type: Touchpoint["type"]) => {
    switch (type) {
      case "ad_click":
        return "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900";
      case "session_start":
        return "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900";
      case "page_view":
        return "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900";
      case "lead":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900";
      case "initiate_checkout":
        return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900";
      case "pix_generated":
        return "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900";
      case "purchase_approved":
        return "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold";
      case "refund":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900";
      case "chargeback":
        return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800";
      default:
        return "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800";
    }
  };

  return (
    <div className="bg-white dark:bg-[#081A33] p-5 rounded-2xl border border-slate-200/90 dark:border-[#142C52] space-y-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#142C52] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#0066FF] dark:text-[#00D4FF]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Jornada Multi-Touch do Comprador
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0066FF] dark:text-[#00D4FF] border border-blue-200 dark:border-blue-900/50">
                {summary.totalTouchpoints} interações
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trajetória cronológica do cliente desde o primeiro anúncio até a conversão
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#061224] border border-slate-200/80 dark:border-[#142C52]">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400">Tempo até conversão:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {summary.timeToConvertFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Path preview sequence */}
      {summary.pathPreview && summary.pathPreview.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs p-3 rounded-xl bg-slate-50 dark:bg-[#061224] border border-slate-100 dark:border-[#142C52]/60">
          <span className="text-slate-400 text-[11px] font-semibold mr-1">Caminho:</span>
          {summary.pathPreview.map((step, idx) => (
            <React.Fragment key={idx}>
              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#0A2244] border border-slate-200/80 dark:border-[#142C52] text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {step}
              </span>
              {idx < summary.pathPreview.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* First-Touch vs Last-Touch Attribution Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
              <Target className="w-3.5 h-3.5" /> Primeiro Toque (First Touch)
            </span>
            {summary.firstTouch?.timestamp && (
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">
                {formatDateTime(summary.firstTouch.timestamp)}
              </span>
            )}
          </div>
          <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">
            {summary.firstTouch?.campaign || summary.firstTouch?.source || "Acesso Direto"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Origem: {summary.firstTouch?.source || "Direto"}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Último Toque (Last Touch)
            </span>
            {summary.lastTouch?.timestamp && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                {formatDateTime(summary.lastTouch.timestamp)}
              </span>
            )}
          </div>
          <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">
            {summary.lastTouch?.campaign || summary.lastTouch?.source || "Checkout Direto"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Origem: {summary.lastTouch?.source || "Direto"}
          </p>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="space-y-4 pt-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Linha do Tempo Cronológica
        </h4>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-[#142C52]">
          {touchpoints.map((t, idx) => (
            <div key={t.id || idx} className="relative group">
              {/* Stepper Circle */}
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white dark:bg-[#081A33] border-2 border-slate-300 dark:border-[#1E3E6B] flex items-center justify-center group-hover:border-[#0066FF] transition-colors">
                <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 group-hover:bg-[#0066FF]" />
              </div>

              {/* Event Card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#061224] border border-slate-200/80 dark:border-[#142C52] space-y-1.5 transition-all hover:border-slate-300 dark:hover:border-[#1E3E6B]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-white dark:bg-[#0A2244] border border-slate-200 dark:border-[#142C52]">
                      {getTouchpointIcon(t.type)}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {t.title}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${getBadgeStyle(
                        t.type
                      )}`}
                    >
                      {t.type.replace("_", " ").toUpperCase()}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateTime(t.timestamp)}
                  </span>
                </div>

                {t.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.description}
                  </p>
                )}

                {/* Additional UTM & Context Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  {t.campaign && (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      Campanha: {t.campaign}
                    </span>
                  )}
                  {t.source && (
                    <span className="text-slate-500 dark:text-slate-400">
                      Origem: {t.source}
                    </span>
                  )}
                  {t.device && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      {t.device === "Mobile" ? (
                        <Smartphone className="w-3 h-3" />
                      ) : (
                        <Laptop className="w-3 h-3" />
                      )}
                      {t.device}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
