// AOP Financials engine — turns the frozen AOP (revenue + cost) plus an
// opening balance sheet into a full P&L, Balance Sheet and Cash Flow, with a
// month-on-month phasing. Pure functions, usable on server or client.

export type Opening = {
  cash: number;
  receivables: number;
  other_current_assets: number;
  fixed_assets_net: number;
  payables: number;
  other_current_liabilities: number;
  share_capital: number;
  reserves: number;
  receivable_days: number;
  payable_days: number;
  depreciation_annual: number;
  tax_rate: number; // %
  capex_annual: number;
};

export type AopInputs = {
  revenue: number; // committed brokerage (annual)
  bhCost: number; // hiring + direct (annual)
  overhead: number; // mid + back office (annual)
};

export type PL = {
  revenue: number;
  bhCost: number;
  overhead: number;
  totalOpex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  tax: number;
  pat: number;
  ebitdaMargin: number;
  patMargin: number;
};

export type BS = {
  cash: number;
  receivables: number;
  otherCA: number;
  fixedAssets: number;
  totalAssets: number;
  payables: number;
  otherCL: number;
  shareCapital: number;
  reserves: number;
  totalEquityLiab: number;
  check: number; // assets − (equity+liab); ≈ opening imbalance
};

export type CF = {
  pat: number;
  depreciation: number;
  deltaReceivables: number;
  deltaPayables: number;
  deltaOtherCA: number;
  deltaOtherCL: number;
  operatingCF: number;
  capex: number;
  investingCF: number;
  financingCF: number;
  netCash: number;
  openingCash: number;
  closingCash: number;
};

export type MonthRow = {
  label: string;
  revenue: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  tax: number;
  pat: number;
  cumPat: number;
  cash: number; // running cash estimate
};

export type Financials = { pl: PL; bs: BS; cf: CF; monthly: MonthRow[]; openingImbalance: number };

const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export function computeFinancials(aop: AopInputs, o: Opening, weights?: number[], year = 2027): Financials {
  const revenue = aop.revenue;
  const totalOpex = aop.bhCost + aop.overhead;
  const ebitda = revenue - totalOpex;
  const depreciation = o.depreciation_annual;
  const ebit = ebitda - depreciation;
  const tax = ebit > 0 ? (ebit * o.tax_rate) / 100 : 0;
  const pat = ebit - tax;

  const pl: PL = {
    revenue, bhCost: aop.bhCost, overhead: aop.overhead, totalOpex,
    ebitda, depreciation, ebit, tax, pat,
    ebitdaMargin: revenue > 0 ? (ebitda / revenue) * 100 : 0,
    patMargin: revenue > 0 ? (pat / revenue) * 100 : 0,
  };

  // Closing balance sheet
  const receivablesCl = (revenue * o.receivable_days) / 365;
  const payablesCl = (totalOpex * o.payable_days) / 365;
  const fixedCl = o.fixed_assets_net + o.capex_annual - depreciation;
  const otherCACl = o.other_current_assets;
  const otherCLCl = o.other_current_liabilities;
  const reservesCl = o.reserves + pat;
  const shareCapitalCl = o.share_capital;

  // Cash flow → closing cash
  const deltaReceivables = receivablesCl - o.receivables;
  const deltaPayables = payablesCl - o.payables;
  const deltaOtherCA = otherCACl - o.other_current_assets;
  const deltaOtherCL = otherCLCl - o.other_current_liabilities;
  const operatingCF = pat + depreciation - deltaReceivables - deltaOtherCA + deltaPayables + deltaOtherCL;
  const capex = o.capex_annual;
  const investingCF = -capex;
  const financingCF = 0;
  const netCash = operatingCF + investingCF + financingCF;
  const closingCash = o.cash + netCash;

  const totalAssets = closingCash + receivablesCl + otherCACl + fixedCl;
  const totalEquityLiab = payablesCl + otherCLCl + shareCapitalCl + reservesCl;

  const bs: BS = {
    cash: closingCash, receivables: receivablesCl, otherCA: otherCACl, fixedAssets: fixedCl,
    totalAssets,
    payables: payablesCl, otherCL: otherCLCl, shareCapital: shareCapitalCl, reserves: reservesCl,
    totalEquityLiab,
    check: totalAssets - totalEquityLiab,
  };

  const cf: CF = {
    pat, depreciation, deltaReceivables, deltaPayables, deltaOtherCA, deltaOtherCL,
    operatingCF, capex, investingCF, financingCF, netCash,
    openingCash: o.cash, closingCash,
  };

  // Monthly phasing
  const w = normalizeWeights(weights);
  let cumPat = 0;
  let runCash = o.cash;
  const cashPerPat = netCash; // approx: distribute net cash by PAT weight
  const totalPat = pat || 1;
  const monthly: MonthRow[] = FY_MONTHS.map((m, i) => {
    const rev = revenue * w[i];
    const opx = totalOpex * w[i];
    const dep = depreciation / 12;
    const eb = rev - opx;
    const ebt = eb - dep;
    const tx = ebt > 0 ? (ebt * o.tax_rate) / 100 : 0;
    const p = ebt - tx;
    cumPat += p;
    runCash += cashPerPat * (p / totalPat);
    const yr = i >= 9 ? year + 1 : year; // Jan–Mar fall in the next calendar year
    return {
      label: `${m} ${yr}`,
      revenue: rev, opex: opx, ebitda: eb, depreciation: dep, ebit: ebt, tax: tx, pat: p,
      cumPat, cash: runCash,
    };
  });

  const openingImbalance =
    (o.cash + o.receivables + o.other_current_assets + o.fixed_assets_net) -
    (o.payables + o.other_current_liabilities + o.share_capital + o.reserves);

  return { pl, bs, cf, monthly, openingImbalance };
}

function normalizeWeights(weights?: number[]): number[] {
  if (!weights || weights.length !== 12) return new Array(12).fill(1 / 12);
  const sum = weights.reduce((s, x) => s + (x || 0), 0);
  if (sum <= 0) return new Array(12).fill(1 / 12);
  return weights.map((x) => (x || 0) / sum);
}
