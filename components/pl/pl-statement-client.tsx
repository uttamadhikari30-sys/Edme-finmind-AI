"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";
import ExportButtons from "@/components/ui/export-buttons";

type Period = { id: string; period_label: string; start_date: string; end_date: string; status: string };
type Account = { id: string; account_code: string; account_name: string; account_type: string };
type BU = { id: string; code: string; name: string };
type AmountByPeriod = Record<string, Record<string, number>>;

type Scope = "ftm" | "ytd" | "fy";

// Map account codes → P&L section. Codes 5000–5099 + 5300 = Direct Cost; rest of 5xxx = Overhead.
function classifyExpense(code: string): "direct" | "overhead" {
  const n = parseInt(code, 10);
  if (n >= 5000 && n <= 5099) return "direct";
  if (n === 5300) return "direct";
  return "overhead";
}

export default function PLStatementClient({
  periods,
  accounts,
  bus,
  actualByAccount,
  budgetByAccount,
}: {
  periods: Period[];
  accounts: Account[];
  bus: BU[];
  actualByAccount: AmountByPeriod;
  budgetByAccount: AmountByPeriod;
}) {
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = periods.find((p) => p.start_date <= today && p.end_date >= today);
  const ytdPeriods = periods.filter((p) => p.end_date <= today);

  const [scope, setScope] = useState<Scope>("ftm");
  const [vertical, setVertical] = useState<string>("");
  const tableRef = useRef<HTMLDivElement>(null);

  const periodIdsInScope = useMemo(() => {
    if (scope === "ftm") return currentPeriod ? [currentPeriod.id] : [];
    if (scope === "ytd") return ytdPeriods.map((p) => p.id);
    return periods.map((p) => p.id); // fy
  }, [scope, periods, currentPeriod, ytdPeriods]);

  const scopeLabel = scope === "ftm"
    ? `${currentPeriod?.period_label ?? "—"} · For the Month (FTM)`
    : scope === "ytd"
    ? `YTD · ${ytdPeriods[0]?.period_label} → ${ytdPeriods.at(-1)?.period_label}`
    : `Full Year · ${periods[0]?.period_label} → ${periods.at(-1)?.period_label}`;

  // Sum value across the scope's periods for an account
  const sumForAccount = (table: AmountByPeriod, accountId: string, periodIds: string[]): number => {
    const byPeriod = table[accountId] ?? {};
    return periodIds.reduce((s, pid) => s + (byPeriod[pid] ?? 0), 0);
  };

  // For LE: actual YTD + (avg of last 3 actual months × remaining months)
  const last3 = ytdPeriods.slice(-3);
  const remainingPeriods = periods.filter((p) => p.end_date > today);

  const leForAccount = (accountId: string): number => {
    const ytd = sumForAccount(actualByAccount, accountId, ytdPeriods.map((p) => p.id));
    if (scope === "ftm") return ytd; // not meaningful at FTM granularity
    if (last3.length === 0) return ytd;
    const recent = last3.map((p) => actualByAccount[accountId]?.[p.id] ?? 0).filter((v) => v !== 0);
    const avg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : 0;
    return ytd + avg * remainingPeriods.length;
  };

  // Build sectioned rows
  const revenueAccounts = accounts.filter((a) => a.account_type === "revenue");
  const directCostAccounts = accounts.filter(
    (a) => a.account_type === "expense" && classifyExpense(a.account_code) === "direct"
  );
  const overheadAccounts = accounts.filter(
    (a) => a.account_type === "expense" && classifyExpense(a.account_code) === "overhead"
  );

  // For each account: actual, aop, var, prior year (placeholder), LE
  type Row = {
    code: string;
    name: string;
    actual: number;
    aop: number;
    py: number;
    le: number;
    isCost?: boolean;
  };

  const buildRow = (acct: Account, isCost = false): Row => {
    const actual = sumForAccount(actualByAccount, acct.id, periodIdsInScope);
    const aop = sumForAccount(budgetByAccount, acct.id, periodIdsInScope);
    const py = 0; // placeholder until prior FY data loaded
    const le = leForAccount(acct.id);
    return { code: acct.account_code, name: acct.account_name, actual, aop, py, le, isCost };
  };

  const revRows = revenueAccounts.map((a) => buildRow(a));
  const directRows = directCostAccounts.map((a) => buildRow(a, true));
  const overheadRows = overheadAccounts.map((a) => buildRow(a, true));

  const sumRows = (rows: Row[], k: keyof Row): number =>
    rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  const totalRev = sumRows(revRows, "actual");
  const totalRevAOP = sumRows(revRows, "aop");
  const totalRevPY = sumRows(revRows, "py");
  const totalRevLE = sumRows(revRows, "le");

  const totalDirect = sumRows(directRows, "actual");
  const totalDirectAOP = sumRows(directRows, "aop");
  const totalDirectPY = sumRows(directRows, "py");
  const totalDirectLE = sumRows(directRows, "le");

  const totalOverhead = sumRows(overheadRows, "actual");
  const totalOverheadAOP = sumRows(overheadRows, "aop");
  const totalOverheadPY = sumRows(overheadRows, "py");
  const totalOverheadLE = sumRows(overheadRows, "le");

  const grossProfit = totalRev - totalDirect;
  const grossProfitAOP = totalRevAOP - totalDirectAOP;
  const grossProfitPY = totalRevPY - totalDirectPY;
  const grossProfitLE = totalRevLE - totalDirectLE;

  const ebitda = grossProfit - totalOverhead;
  const ebitdaAOP = grossProfitAOP - totalOverheadAOP;
  const ebitdaPY = grossProfitPY - totalOverheadPY;
  const ebitdaLE = grossProfitLE - totalOverheadLE;

  const taxEst = ebitda > 0 ? ebitda * 0.25 : 0;
  const taxEstAOP = ebitdaAOP > 0 ? ebitdaAOP * 0.25 : 0;
  const taxEstPY = ebitdaPY > 0 ? ebitdaPY * 0.25 : 0;
  const taxEstLE = ebitdaLE > 0 ? ebitdaLE * 0.25 : 0;

  const pat = ebitda - taxEst;
  const patAOP = ebitdaAOP - taxEstAOP;
  const patPY = ebitdaPY - taxEstPY;
  const patLE = ebitdaLE - taxEstLE;

  const aboveAOP = totalRev >= totalRevAOP;

  return (
    <div className="space-y-4">
      {/* Period scope toggle + Vertical selector + Excel */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {(
            [
              { id: "ftm", label: "FTM", sub: currentPeriod?.period_label ?? "—" },
              {
                id: "ytd",
                label: "YTD",
                sub: `${ytdPeriods[0]?.period_label.split(" ")[0] ?? "Apr"}–${
                  ytdPeriods.at(-1)?.period_label.split(" ")[0] ?? "Oct"
                } ${ytdPeriods.at(-1)?.period_label.split(" ")[1] ?? ""}`,
              },
              { id: "fy", label: "Full Year", sub: `FY ${periods[0]?.period_label.split(" ")[1]?.slice(2) ?? ""}-${(parseInt(periods.at(-1)?.period_label.split(" ")[1] ?? "26") % 100).toString().padStart(2, "0")}` },
            ] as { id: Scope; label: string; sub: string }[]
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={`px-5 py-3 rounded-xl border-2 transition text-left ${
                scope === s.id
                  ? "border-navy bg-white shadow-soft"
                  : "border-[var(--border)] bg-white hover:border-navy/40"
              }`}
            >
              <div className={`text-[14px] font-bold ${scope === s.id ? "text-navy" : "text-ink"}`}>
                {s.label}
              </div>
              <div className="text-[10.5px] text-ink-subtle font-mono mt-0.5">{s.sub}</div>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-white">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle font-bold">Vertical</span>
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="text-[12px] font-semibold text-navy bg-transparent outline-none cursor-pointer"
          >
            <option value="">Company — Consolidated</option>
            {bus.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        </div>

        <ExportButtons reportName={`P&L Statement · ${scopeLabel}`} containerRef={tableRef} />
      </div>

      {/* Header strip with status */}
      <Card>
        <CardBody className="py-3 px-5 flex items-center gap-3 flex-wrap">
          <h3 className="font-serif text-[16px] font-bold text-navy">{scopeLabel}</h3>
          <div className="flex-1" />
          <span
            className={`pill ${
              aboveAOP ? "pill-green" : "pill-red"
            }`}
          >
            {aboveAOP ? "✓ Above AOP" : "Below AOP"}
          </span>
          <span className="text-[11px] text-ink-subtle">
            Company P&amp;L · {currentPeriod?.period_label ?? ""}
          </span>
        </CardBody>
      </Card>

      {/* Main table */}
      <Card>
        <CardBody className="p-0">
          <div ref={tableRef} className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>P&amp;L HEAD</th>
                  <th className="r">ACTUAL</th>
                  <th className="r">AOP</th>
                  <th className="r">VAR ₹</th>
                  <th className="r">VAR %</th>
                  <th className="r">PRIOR YEAR</th>
                  <th className="r">YOY %</th>
                  <th className="r">LE</th>
                  <th className="r">LE VS AOP%</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <SectionRow label="REVENUE" />
                {revRows.map((r, i) => (
                  <DataRow key={r.code} num={i + 1} row={r} currency={currency} />
                ))}
                <TotalRow
                  num={revRows.length + 1}
                  label="Total Revenue"
                  actual={totalRev}
                  aop={totalRevAOP}
                  py={totalRevPY}
                  le={totalRevLE}
                  currency={currency}
                />

                <SectionRow label="DIRECT COST" />
                {directRows.map((r, i) => (
                  <DataRow
                    key={r.code}
                    num={revRows.length + 2 + i}
                    row={r}
                    currency={currency}
                  />
                ))}
                <TotalRow
                  num={revRows.length + directRows.length + 2}
                  label="Total Direct Cost"
                  actual={totalDirect}
                  aop={totalDirectAOP}
                  py={totalDirectPY}
                  le={totalDirectLE}
                  currency={currency}
                  isCost
                />

                <SubtotalRow
                  label="GROSS PROFIT"
                  actual={grossProfit}
                  aop={grossProfitAOP}
                  py={grossProfitPY}
                  le={grossProfitLE}
                  currency={currency}
                  toneNeutral
                />

                <SectionRow label="OVERHEADS" />
                {overheadRows.map((r, i) => (
                  <DataRow
                    key={r.code}
                    num={revRows.length + directRows.length + 3 + i}
                    row={r}
                    currency={currency}
                  />
                ))}
                <TotalRow
                  num={revRows.length + directRows.length + overheadRows.length + 3}
                  label="Total Overheads"
                  actual={totalOverhead}
                  aop={totalOverheadAOP}
                  py={totalOverheadPY}
                  le={totalOverheadLE}
                  currency={currency}
                  isCost
                />

                <SubtotalRow
                  label="EBITDA"
                  actual={ebitda}
                  aop={ebitdaAOP}
                  py={ebitdaPY}
                  le={ebitdaLE}
                  currency={currency}
                />

                <SubtotalRow
                  label="− Tax (Est. 25%)"
                  actual={taxEst}
                  aop={taxEstAOP}
                  py={taxEstPY}
                  le={taxEstLE}
                  currency={currency}
                  isCost
                  toneNeutral
                />

                <SubtotalRow
                  label="PAT"
                  actual={pat}
                  aop={patAOP}
                  py={patPY}
                  le={patLE}
                  currency={currency}
                  emphasize
                />
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="text-[10.5px] text-ink-subtle italic px-2">
        Numbers are in {currency.code}. Prior Year and AOP columns require prior FY data and budget setup respectively
        — set up budget in <a href="/budget-aop" className="text-navy font-semibold hover:underline">Budget / AOP</a>{" "}
        and load prior FY data via <a href="/ledger-upload" className="text-navy font-semibold hover:underline">Ledger Upload</a>{" "}
        to populate those columns.
      </div>
    </div>
  );
}

// =========================================================================
// Row components
// =========================================================================

function SectionRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={11} className="bg-navy-50 text-[10.5px] font-bold uppercase tracking-[1.5px] text-navy py-2">
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  num,
  row,
  currency,
}: {
  num: number;
  row: { code: string; name: string; actual: number; aop: number; py: number; le: number; isCost?: boolean };
  currency: ReturnType<typeof useCurrency>;
}) {
  const var_amt = row.actual - row.aop;
  const var_pct = row.aop !== 0 ? (var_amt / Math.abs(row.aop)) * 100 : null;
  const yoy_pct = row.py !== 0 ? ((row.actual - row.py) / Math.abs(row.py)) * 100 : null;
  const le_vs_aop = row.aop !== 0 ? ((row.le - row.aop) / Math.abs(row.aop)) * 100 : null;

  // Status: revenue+ over AOP = OK; cost+ over AOP = OVER
  const isVarFavorable = row.isCost ? var_amt <= 0 : var_amt >= 0;
  const status =
    row.aop === 0
      ? null
      : isVarFavorable
      ? { label: "OK", tone: "pill-green" }
      : { label: "Over", tone: "pill-red" };

  const varColor = isVarFavorable ? "text-edgreen" : "text-edred";

  return (
    <tr>
      <td className="text-ink-subtle">{num}</td>
      <td className="text-ink-muted">{row.name}</td>
      <td className="r font-mono font-bold text-navy">{formatCurrencyLakhs(row.actual, currency)}</td>
      <td className="r font-mono text-ink-subtle">
        {row.aop === 0 ? "—" : formatCurrencyLakhs(row.aop, currency)}
      </td>
      <td className={`r font-mono font-bold ${row.aop === 0 ? "text-ink-subtle" : varColor}`}>
        {row.aop === 0
          ? "—"
          : `${var_amt >= 0 ? "+" : ""}${formatCurrencyLakhs(var_amt, currency)}`}
      </td>
      <td className={`r font-mono font-bold ${var_pct == null ? "text-ink-subtle" : varColor}`}>
        {var_pct == null ? "—" : `${var_pct >= 0 ? "+" : ""}${var_pct.toFixed(1)}%`}
      </td>
      <td className="r font-mono text-ink-subtle">
        {row.py === 0 ? "—" : formatCurrencyLakhs(row.py, currency)}
      </td>
      <td
        className={`r font-mono font-bold ${
          yoy_pct == null ? "text-ink-subtle" : yoy_pct >= 0 ? "text-edgreen" : "text-edred"
        }`}
      >
        {yoy_pct == null ? "—" : `${yoy_pct >= 0 ? "+" : ""}${yoy_pct.toFixed(1)}%`}
      </td>
      <td className="r font-mono font-bold text-navy">{formatCurrencyLakhs(row.le, currency)}</td>
      <td
        className={`r font-mono font-bold ${
          le_vs_aop == null ? "text-ink-subtle" : le_vs_aop >= 0 === !row.isCost ? "text-edgreen" : "text-edred"
        }`}
      >
        {le_vs_aop == null ? "—" : `${le_vs_aop >= 0 ? "+" : ""}${le_vs_aop.toFixed(1)}%`}
      </td>
      <td>
        {status && (
          <span className={`pill ${status.tone}`}>
            <span className="pill-dot" /> {status.label}
          </span>
        )}
      </td>
    </tr>
  );
}

function TotalRow({
  num,
  label,
  actual,
  aop,
  py,
  le,
  currency,
  isCost,
}: {
  num: number;
  label: string;
  actual: number;
  aop: number;
  py: number;
  le: number;
  currency: ReturnType<typeof useCurrency>;
  isCost?: boolean;
}) {
  return (
    <DataRow
      num={num}
      row={{ code: "", name: label, actual, aop, py, le, isCost }}
      currency={currency}
    />
  );
}

function SubtotalRow({
  label,
  actual,
  aop,
  py,
  le,
  currency,
  isCost,
  emphasize,
  toneNeutral,
}: {
  label: string;
  actual: number;
  aop: number;
  py: number;
  le: number;
  currency: ReturnType<typeof useCurrency>;
  isCost?: boolean;
  emphasize?: boolean;
  toneNeutral?: boolean;
}) {
  const var_amt = actual - aop;
  const var_pct = aop !== 0 ? (var_amt / Math.abs(aop)) * 100 : null;
  const yoy_pct = py !== 0 ? ((actual - py) / Math.abs(py)) * 100 : null;
  const le_vs_aop = aop !== 0 ? ((le - aop) / Math.abs(aop)) * 100 : null;
  const isVarFavorable = isCost ? var_amt <= 0 : var_amt >= 0;
  const varColor = toneNeutral ? "text-ink-muted" : isVarFavorable ? "text-edgreen" : "text-edred";

  return (
    <tr
      className={`${
        emphasize
          ? "bg-edgreen-50/60 border-y-2 border-edgreen/30 font-bold"
          : "bg-navy-50/40 border-y-2 border-navy/20 font-bold"
      }`}
    >
      <td colSpan={2} className={`uppercase tracking-[1.5px] text-[11px] ${emphasize ? "text-edgreen" : "text-navy"}`}>
        {label}
      </td>
      <td className="r font-mono text-navy">{formatCurrencyLakhs(actual, currency)}</td>
      <td className="r font-mono text-ink-muted">
        {aop === 0 ? "—" : formatCurrencyLakhs(aop, currency)}
      </td>
      <td className={`r font-mono ${aop === 0 ? "text-ink-subtle" : varColor}`}>
        {aop === 0 ? "—" : `${var_amt >= 0 ? "+" : ""}${formatCurrencyLakhs(var_amt, currency)}`}
      </td>
      <td className={`r font-mono ${var_pct == null ? "text-ink-subtle" : varColor}`}>
        {var_pct == null ? "—" : `${var_pct >= 0 ? "+" : ""}${var_pct.toFixed(1)}%`}
      </td>
      <td className="r font-mono text-ink-muted">
        {py === 0 ? "—" : formatCurrencyLakhs(py, currency)}
      </td>
      <td
        className={`r font-mono ${
          yoy_pct == null ? "text-ink-subtle" : yoy_pct >= 0 ? "text-edgreen" : "text-edred"
        }`}
      >
        {yoy_pct == null ? "—" : `${yoy_pct >= 0 ? "+" : ""}${yoy_pct.toFixed(1)}%`}
      </td>
      <td className="r font-mono text-navy">{formatCurrencyLakhs(le, currency)}</td>
      <td
        className={`r font-mono ${
          le_vs_aop == null
            ? "text-ink-subtle"
            : le_vs_aop >= 0 === !isCost
            ? "text-edgreen"
            : "text-edred"
        }`}
      >
        {le_vs_aop == null ? "—" : `${le_vs_aop >= 0 ? "+" : ""}${le_vs_aop.toFixed(1)}%`}
      </td>
      <td></td>
    </tr>
  );
}
