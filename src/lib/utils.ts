import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
export { formatMetric } from "./metrics";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type DateRange = {
  from: Date;
  to: Date;
  label: string;
};

/**
 * Resolves accurate DateRange for all standard analytics presets.
 * Supports both pt-BR strings and camelCase identifiers.
 */
export function getDateRange(preset: string): DateRange {
  const now = new Date();
  const normalized = (preset || "").trim().toLowerCase();

  // 1. Hoje
  if (normalized === "hoje" || normalized === "today") {
    return { from: startOfDay(now), to: endOfDay(now), label: "Hoje" };
  }

  // 2. Ontem
  if (normalized === "ontem" || normalized === "yesterday") {
    const yesterday = subDays(now, 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday), label: "Ontem" };
  }

  // 3. Últimos 7 dias
  if (normalized.includes("7") || normalized === "last7days") {
    return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), label: "Últimos 7 dias" };
  }

  // 4. Últimos 15 dias
  if (normalized.includes("15") || normalized === "last15days") {
    return { from: startOfDay(subDays(now, 14)), to: endOfDay(now), label: "Últimos 15 dias" };
  }

  // 5. Últimos 30 dias
  if (normalized.includes("30") || normalized === "last30days") {
    return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), label: "Últimos 30 dias" };
  }

  // 6. Últimos 60 dias
  if (normalized.includes("60") || normalized === "last60days") {
    return { from: startOfDay(subDays(now, 59)), to: endOfDay(now), label: "Últimos 60 dias" };
  }

  // 7. Últimos 90 dias
  if (normalized.includes("90") || normalized === "last90days") {
    return { from: startOfDay(subDays(now, 89)), to: endOfDay(now), label: "Últimos 90 dias" };
  }

  // 8. Este mês
  if (normalized.includes("este m") || normalized === "thismonth") {
    return { from: startOfMonth(now), to: endOfMonth(now), label: "Este mês" };
  }

  // 9. Mês anterior
  if (normalized.includes("anterior") || normalized === "lastmonth") {
    const lastMonth = subMonths(now, 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth),
      label: "Mês anterior",
    };
  }

  // Fallback padrão: Últimos 30 dias
  return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), label: "Últimos 30 dias" };
}

export function formatDate(date: Date | string, pattern = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateId(prefix = ""): string {
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/** Truncate a string for display */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

/** Parse a JSON string safely, returning null on failure */
export function safeParseJSON<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** Convert a value to cents (integer) */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Convert cents to decimal currency value */
export function fromCents(cents: number): number {
  return cents / 100;
}
