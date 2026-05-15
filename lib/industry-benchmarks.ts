/**
 * Indian Insurance Broking — Industry Benchmarks
 * Sourced from IRDAI annual reports, SBI Capital broker research,
 * and industry-standard financial ratios for mid-size general insurance brokers.
 * Used by AI Insights to ground recommendations in real-world context.
 */

export type Benchmark = {
  id: string;
  label: string;
  target: number;
  unit: "%" | "ratio" | "multiplier";
  source: string;
  note: string;
  good: (v: number) => boolean;
  format?: (v: number) => string;
};

export const BENCHMARKS: Record<string, Benchmark> = {
  ebitda_margin: {
    id: "ebitda_margin",
    label: "EBITDA Margin",
    target: 25,
    unit: "%",
    source: "IRDAI broker peer median",
    note: "Listed Indian brokers average 25–32% EBITDA margin",
    good: (v) => v >= 25,
  },
  expense_ratio: {
    id: "expense_ratio",
    label: "Operating Expense Ratio",
    target: 70,
    unit: "%",
    source: "Indian general insurance brokers (mid-cap)",
    note: "Healthy expense ratio: < 70% of revenue. Above 75% signals overhead pressure",
    good: (v) => v <= 70,
  },
  salary_to_revenue: {
    id: "salary_to_revenue",
    label: "Salary Cost as % of Revenue",
    target: 22,
    unit: "%",
    source: "Listed broker median (FY25)",
    note: "Front-office + mid-office + support: typical 18–25% for general insurance brokers",
    good: (v) => v <= 25,
  },
  admin_to_revenue: {
    id: "admin_to_revenue",
    label: "Admin Overhead as % of Revenue",
    target: 12,
    unit: "%",
    source: "Industry mid-cap broker average",
    note: "Office rent + marketing + travel + professional fees: 8–15% is healthy",
    good: (v) => v <= 15,
  },
  pat_margin: {
    id: "pat_margin",
    label: "Net Profit Margin (PAT)",
    target: 18,
    unit: "%",
    source: "Sectoral analysis",
    note: "After tax: 15–20% is strong for a broker",
    good: (v) => v >= 15,
  },
  revenue_per_employee: {
    id: "revenue_per_employee",
    label: "Revenue per Employee",
    target: 25,
    unit: "%",
    source: "Indian broker median",
    note: "₹20L–₹30L per head is the productivity benchmark for general insurance brokers",
    good: (v) => v >= 20,
    format: (v) => `₹${v.toFixed(1)} L per head`,
  },
  vertical_concentration: {
    id: "vertical_concentration",
    label: "Top Vertical Concentration",
    target: 30,
    unit: "%",
    source: "Diversification best practice",
    note: "No single vertical should account for > 35% of revenue. > 40% = concentration risk",
    good: (v) => v <= 35,
  },
  yoy_growth: {
    id: "yoy_growth",
    label: "Y-o-Y Revenue Growth",
    target: 15,
    unit: "%",
    source: "Indian insurance broking sector",
    note: "Sector growing 12–18% YoY · achieving > 15% beats market",
    good: (v) => v >= 15,
  },
  variable_pay_pool: {
    id: "variable_pay_pool",
    label: "Variable Pay Pool",
    target: 4.5,
    unit: "%",
    source: "Industry compensation surveys",
    note: "3.5–5% of revenue is the sweet spot for VPB pool in commission-driven businesses",
    good: (v) => v >= 3.5 && v <= 5.5,
  },
  brokerage_on_premium: {
    id: "brokerage_on_premium",
    label: "Brokerage Commission Rate",
    target: 10,
    unit: "%",
    source: "IRDAI commission caps by line of business",
    note: "Health: up to 17.5% · Motor: 15% · Property: 12.5% · Life single premium: 7.5%",
    good: () => true,
  },
};

export type BenchmarkResult = {
  benchmark: Benchmark;
  actual: number;
  delta: number;
  status: "ahead" | "on-track" | "behind";
};

export function compareToBenchmark(benchmarkId: string, actual: number): BenchmarkResult {
  const b = BENCHMARKS[benchmarkId]!;
  const delta = actual - b.target;
  const status: BenchmarkResult["status"] = b.good(actual)
    ? Math.abs(delta) <= 2
      ? "on-track"
      : "ahead"
    : "behind";
  return { benchmark: b, actual, delta, status };
}

/**
 * Insurance broker best-practice playbook — Maya / AI Insights surface these contextually.
 */
export const BEST_PRACTICES = {
  margin: [
    "Negotiate higher trail commissions on multi-year corporate accounts to lift recurring revenue mix.",
    "Push advisory fees alongside commission to lift gross margin without IRDAI commission caps.",
    "Consolidate vendor spend (printing, travel, IT) for 8–12% margin pickup.",
  ],
  vertical: [
    "Diversify book if any single vertical > 35% of revenue — concentration risk for IRDAI audit.",
    "Health & Cyber are fastest-growing — invest in BHs there for outsized FY27 growth.",
    "Renewal-heavy verticals (Corporate, Group Health) deserve dedicated retention specialists.",
  ],
  cost: [
    "Mid-office costs should scale with policies-per-employee, not total headcount.",
    "Support-function costs should be allocated by revenue share (not equal split) for fair vertical P&L.",
    "Travel & BD spend should never exceed 1% of revenue without ROI justification.",
  ],
  cash: [
    "Working capital tied up in receivables > 60 days = chase collection harder.",
    "Brokerage payouts to insurers should be matched to collection cycle — avoid pre-funding insurer remittances.",
    "Build reserves equal to 1.5× monthly operating cost as cash buffer.",
  ],
  forecasting: [
    "Use rolling 3-month average for Latest Estimate, not point-in-time pipeline.",
    "Corporate Q3 (Oct–Dec) is highest-renewal — front-load BH effort here.",
    "Strip out one-time wins (large new client) from run-rate for cleaner LE.",
  ],
  vpb: [
    "Tier multipliers should be aggressive at >110% achievement to drive stretch behaviour.",
    "Pool tied to EBITDA (not just revenue) prevents over-payout in margin-compressed months.",
    "Quarterly mini-VPB pools work better than annual lump-sum for cash flow & motivation.",
  ],
};
