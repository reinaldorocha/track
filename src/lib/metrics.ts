/**
 * Metric calculation formulas for UTM-Track.
 * All functions handle division by zero gracefully.
 */

/** Cost per Mille (thousand impressions) */
export function calcCPM(spend: number, impressions: number): number | null {
  if (impressions === 0) return null;
  return (spend / impressions) * 1000;
}

/** Cost per Click */
export function calcCPC(spend: number, clicks: number): number | null {
  if (clicks === 0) return null;
  return spend / clicks;
}

/** Click-Through Rate (%) */
export function calcCTR(clicks: number, impressions: number): number | null {
  if (impressions === 0) return null;
  return (clicks / impressions) * 100;
}

/** Cost per Initiation of Checkout */
export function calcCPI(spend: number, checkoutInitiations: number): number | null {
  if (checkoutInitiations === 0) return null;
  return spend / checkoutInitiations;
}

/** Cost per Acquisition (purchase) */
export function calcCPA(spend: number, purchases: number): number | null {
  if (purchases === 0) return null;
  return spend / purchases;
}

/** Return on Ad Spend */
export function calcROAS(revenue: number, spend: number): number | null {
  if (spend === 0) return null;
  return revenue / spend;
}

/** Return on Investment (%) */
export function calcROI(profit: number, investment: number): number | null {
  if (investment === 0) return null;
  return (profit / investment) * 100;
}

/** Profit margin (%) */
export function calcMargin(profit: number, revenue: number): number | null {
  if (revenue === 0) return null;
  return (profit / revenue) * 100;
}

/**
 * Calculate profit.
 * profit = netRevenue - adSpend - productCost - fees - taxes - expenses
 */
export function calcProfit(params: {
  netRevenue: number;
  adSpend: number;
  productCost: number;
  fees: number;
  taxes: number;
  expenses: number;
}): number {
  return (
    params.netRevenue -
    params.adSpend -
    params.productCost -
    params.fees -
    params.taxes -
    params.expenses
  );
}

/** Format a metric value for display, returning "—" when null */
export function formatMetric(
  value: number | null,
  type: "currency" | "percent" | "number" | "ratio" = "number",
  currency = "BRL"
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";

  switch (type) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    case "ratio":
      return value.toFixed(2) + "x";
    case "number":
    default:
      return new Intl.NumberFormat("pt-BR").format(Math.round(value));
  }
}

/** Get percentage change between two values */
export function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
