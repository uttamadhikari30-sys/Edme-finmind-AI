"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { computeFinancials, type Opening, type AopInputs } from "@/lib/aop-financials";

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

const OPENING_FIELDS: { key: keyof Opening; label: string; group: "asset" | "liab" | "assum"; suffix?: string }[] = [
  { key: "cash", label: "Cash & bank", group: "asset" },
  { key: "receivables", label: "Receivables (Debtors)", group: "asset" },
  { key: "other_current_assets", label: "Other current assets", group: "asset" },
  { key: "fixed_assets_net", label: "Fixed assets (net)", group: "asset" },
  { key: "payables", label: "Payables (Creditors)", group: "liab" },
  { key: "other_current_liabilities", label: "Other current liabilities", group: "liab" },
  { key: "share_capital", label: "Share capital", group: "liab" },
  { key: "reserves", label: "Reserves & surplus", group: "liab" },
  { key: "receivable_days", label: "Receivable days (DSO)", group: "assum", suffix: "days" },
  { key: "payable_days", label: "Payable days (DPO)", group: "assum", suffix: "days" },
  { key: "depreciation_annual", label: "Depreciation (annual)", group: "assum" },
  { key: "capex_annual", label: "Capex (annual)", group: "assum" },
  { key: "tax_rate", label: "Tax rate", group: "assum", suffix: "%" },
];

export default function FinancialsClient({
  fiscalYear,
  aop,
  initialOpening,
  weights,
  canEdit,
  view = "all",
}: {
  fiscalYear: string;
  aop: AopInputs;
  initialOpening: Opening;
  weights: number[];
  canEdit: boolean;
  view?: "all" | "pl" | "bs" | "cfs";
}) {
  const [o, setO] = useState<Opening>(initialOpening);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fin = useMemo(() => computeFinancials(aop, o, weights), [aop, o, weights]);

  function set(key: keyof Opening, v: number) {
    setO((prev) => ({ ...prev, [key]: v }));
    setMsg(null);
  }

  async function save() {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/aop/save-opening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: fiscalYear, opening: o }),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? "✓ Opening balances saved" : `⚠ ${data.error}`);
  }

  const numInp = "w-32 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[12px] text-right font-mono focus:border-navy outline-none disabled:bg-paper";
  const assets = OPENING_FIELDS.filter((f) => f.group === "asset");
  const liabs = OPENING_FIELDS.filter((f) => f.group === "liab");
  const assums = OPENING_FIELDS.filter((f) => f.group === "assum");

  return (
    <div className="space-y-4">
      {/* KPI band */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric label="Revenue (Brokerage)" value={L(fin.pl.revenue)} tone="green" />
        <Metric label="EBITDA" value={L(fin.pl.ebitda)} sub={`${fin.pl.ebitdaMargin.toFixed(1)}%`} tone="navy" />
        <Metric label="PAT" value={L(fin.pl.pat)} sub={`${fin.pl.patMargin.toFixed(1)}%`} tone={fin.pl.pat >= 0 ? "navy" : "red"} />
        <Metric label="Closing Cash" value={L(fin.cf.closingCash)} tone="gold" />
        <Metric label="Balance Check" value={L(fin.bs.check)} sub={Math.abs(fin.bs.check) < 1 ? "balanced" : "opening imbalance"} tone={Math.abs(fin.bs.check) < 1 ? "green" : "red"} />
      </div>

      {/* Opening balances + assumptions */}
      <Card>
        <CardHeader
          title={`Opening Balance Sheet & Assumptions (${fiscalYear})`}
          tag={{ label: canEdit ? "Finance input" : "read-only", tone: "navy" }}
          right={canEdit && (
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-edred text-white text-[12px] font-semibold hover:bg-edred-600 disabled:opacity-60">
              {saving ? "Saving…" : "Save opening"}
            </button>
          )}
        />
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <OpeningGroup title="Opening Assets" fields={assets} o={o} set={set} canEdit={canEdit} numInp={numInp} />
            <OpeningGroup title="Opening Equity & Liabilities" fields={liabs} o={o} set={set} canEdit={canEdit} numInp={numInp} />
            <OpeningGroup title="Assumptions" fields={assums} o={o} set={set} canEdit={canEdit} numInp={numInp} />
          </div>
          {Math.abs(fin.openingImbalance) >= 1 && (
            <p className="text-[11px] text-edred mt-3">
              ⚠ Opening assets and equity+liabilities differ by {L(fin.openingImbalance)}. Balance the opening sheet so the statements tie out.
            </p>
          )}
          {msg && (
            <div className={`mt-3 text-[12.5px] font-semibold rounded-lg px-4 py-2 ${msg.startsWith("✓") ? "bg-edgreen-50 text-edgreen border border-edgreen/20" : "bg-edred-50 text-edred border border-edred/20"}`}>{msg}</div>
          )}
        </CardBody>
      </Card>

      {/* Statement(s) */}
      <div className={view === "all" ? "grid grid-cols-1 lg:grid-cols-3 gap-4" : "max-w-xl"}>
        {(view === "all" || view === "pl") && (
          <Statement title="AOP P&L" rows={[
            ["Revenue (Brokerage)", fin.pl.revenue, "navy", true],
            ["BH Cost (hiring + direct)", -fin.pl.bhCost, "red"],
            ["Overhead (mid + back)", -fin.pl.overhead, "red"],
            ["EBITDA", fin.pl.ebitda, "green", true],
            ["Depreciation", -fin.pl.depreciation, "red"],
            ["EBIT", fin.pl.ebit, "navy", true],
            [`Tax (${o.tax_rate}%)`, -fin.pl.tax, "red"],
            ["PAT", fin.pl.pat, "purple", true],
          ]} />
        )}
        {(view === "all" || view === "bs") && (
          <Statement title="Balance Sheet (Closing)" rows={[
            ["Cash & bank", fin.bs.cash, "navy"],
            ["Receivables", fin.bs.receivables, "navy"],
            ["Other current assets", fin.bs.otherCA, "navy"],
            ["Fixed assets (net)", fin.bs.fixedAssets, "navy"],
            ["Total Assets", fin.bs.totalAssets, "green", true],
            ["Payables", fin.bs.payables, "navy"],
            ["Other current liab.", fin.bs.otherCL, "navy"],
            ["Share capital", fin.bs.shareCapital, "navy"],
            ["Reserves & surplus", fin.bs.reserves, "navy"],
            ["Total Equity + Liab.", fin.bs.totalEquityLiab, "green", true],
          ]} />
        )}
        {(view === "all" || view === "cfs") && (
          <Statement title="Cash Flow" rows={[
            ["PAT", fin.cf.pat, "navy"],
            ["+ Depreciation", fin.cf.depreciation, "green"],
            ["− Δ Receivables", -fin.cf.deltaReceivables, fin.cf.deltaReceivables <= 0 ? "green" : "red"],
            ["+ Δ Payables", fin.cf.deltaPayables, fin.cf.deltaPayables >= 0 ? "green" : "red"],
            ["Operating Cash Flow", fin.cf.operatingCF, "navy", true],
            ["− Capex (Investing)", fin.cf.investingCF, "red"],
            ["Financing", fin.cf.financingCF, "navy"],
            ["Net Cash Flow", fin.cf.netCash, "navy", true],
            ["Opening Cash", fin.cf.openingCash, "navy"],
            ["Closing Cash", fin.cf.closingCash, "purple", true],
          ]} />
        )}
      </div>

      {/* Monthly phasing (per statement) */}
      <Card>
        <CardHeader
          title={`Month-on-Month ${view === "bs" ? "Balance Sheet" : view === "cfs" ? "Cash Flow" : "P&L"}`}
          tag={{ label: "auto-phased", tone: "navy" }}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="fm-table">
              {view === "bs" ? (
                <>
                  <thead><tr><th>Month</th><th className="r">Cash</th><th className="r">Reserves</th><th className="r">Cum. Revenue</th><th className="r">Net Worth</th></tr></thead>
                  <tbody>
                    {fin.monthly.map((m, i) => {
                      const reserves = o.reserves + m.cumPat;
                      const cumRev = fin.monthly.slice(0, i + 1).reduce((s, x) => s + x.revenue, 0);
                      return (
                        <tr key={m.label}>
                          <td className="font-semibold">{m.label}</td>
                          <td className="r font-mono">{L(m.cash)}</td>
                          <td className="r">{L(reserves)}</td>
                          <td className="r text-ink-subtle">{L(cumRev)}</td>
                          <td className="r font-semibold text-navy">{L(o.share_capital + reserves)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : view === "cfs" ? (
                <>
                  <thead><tr><th>Month</th><th className="r">PAT</th><th className="r">+ Dep.</th><th className="r">Operating CF</th><th className="r">Closing Cash</th></tr></thead>
                  <tbody>
                    {fin.monthly.map((m) => {
                      const opcf = m.pat + m.depreciation;
                      return (
                        <tr key={m.label}>
                          <td className="font-semibold">{m.label}</td>
                          <td className="r">{L(m.pat)}</td>
                          <td className="r text-ink-subtle">{L(m.depreciation)}</td>
                          <td className="r font-semibold text-edgreen">{L(opcf)}</td>
                          <td className="r font-mono font-semibold">{L(m.cash)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th>Month</th><th className="r">Revenue</th><th className="r">Opex</th><th className="r">EBITDA</th><th className="r">Dep.</th><th className="r">PAT</th><th className="r">Cum. PAT</th></tr></thead>
                  <tbody>
                    {fin.monthly.map((m) => (
                      <tr key={m.label}>
                        <td className="font-semibold">{m.label}</td>
                        <td className="r">{L(m.revenue)}</td>
                        <td className="r text-ink-subtle">{L(m.opex)}</td>
                        <td className="r font-semibold text-edgreen">{L(m.ebitda)}</td>
                        <td className="r text-ink-subtle">{L(m.depreciation)}</td>
                        <td className={`r font-semibold ${m.pat >= 0 ? "text-navy" : "text-edred"}`}>{L(m.pat)}</td>
                        <td className="r text-ink-subtle">{L(m.cumPat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-[11px] text-ink-muted">
        Generated from the frozen AOP (committed brokerage and cost) plus the opening balance sheet above. Receivables and payables
        use your DSO/DPO assumptions; cash is the balancing figure. The month-on-month view auto-phases the annual plan across the year.
      </p>
    </div>
  );
}

function OpeningGroup({ title, fields, o, set, canEdit, numInp }: {
  title: string; fields: typeof OPENING_FIELDS; o: Opening; set: (k: keyof Opening, v: number) => void; canEdit: boolean; numInp: string;
}) {
  return (
    <div>
      <div className="text-[12px] font-bold text-navy mb-2">{title}</div>
      <div className="space-y-1.5">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-ink-muted">{f.label}</span>
            <div className="flex items-center gap-1">
              <input type="number" disabled={!canEdit} className={numInp}
                value={o[f.key]} onChange={(e) => set(f.key, Number(e.target.value))} />
              {f.suffix && <span className="text-[10px] text-ink-subtle w-8">{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tone = "navy" | "green" | "red" | "gold" | "purple";
function Statement({ title, rows }: { title: string; rows: (readonly [string, number, Tone, boolean?])[] }) {
  const color: Record<Tone, string> = { navy: "text-navy", green: "text-edgreen", red: "text-edred", gold: "text-gold", purple: "text-edpurple" };
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="py-2">
        {rows.map(([label, value, tone, total], i) => (
          <div key={i} className={`flex items-center justify-between py-1.5 ${total ? "border-t border-[var(--border)] mt-0.5" : ""}`}>
            <span className={`text-[12px] ${total ? "font-bold text-navy" : "text-ink-muted"}`}>{label}</span>
            <span className={`font-mono text-[12.5px] ${total ? "font-bold" : ""} ${(color as any)[tone]}`}>
              {value < 0 ? "−" : ""}₹{(Math.abs(value) / 1e5).toFixed(2)} L
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: Tone }) {
  const color: Record<Tone, string> = { navy: "text-navy", green: "text-edgreen", red: "text-edred", gold: "text-gold", purple: "text-edpurple" };
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[18px] font-bold mt-0.5 ${color[tone]}`}>{value}</div>
        {sub && <div className="text-[10px] text-ink-muted mt-0.5">{sub}</div>}
      </CardBody>
    </Card>
  );
}
