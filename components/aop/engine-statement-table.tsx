"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Financials, Opening } from "@/lib/aop-financials";

const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const Lk = (v: number) => (v === 0 ? "—" : `${v < 0 ? "−" : ""}₹${(Math.abs(v) / 1e5).toFixed(1)}`);
const LkT = (v: number) => `${v < 0 ? "−" : ""}₹${(Math.abs(v) / 1e5).toFixed(2)} L`;

type Line = { name: string; monthly: number[]; isTotal?: boolean; indent?: boolean };
type Section = { label: string; lines: Line[] };

function sum(a: number[]) { return a.reduce((s, x) => s + x, 0); }
function cum(a: number[], i: number) { return a.slice(0, i + 1).reduce((s, x) => s + x, 0); }

// Build the sectioned, monthly line items for a statement from the engine output.
function buildSections(view: "pl" | "bs" | "cfs", fin: Financials, o: Opening): Section[] {
  const m = fin.monthly;
  const rev = m.map((x) => x.revenue);
  const opex = m.map((x) => x.opex);
  const dep = m.map((x) => x.depreciation);
  const pat = m.map((x) => x.pat);
  const bhShare = fin.pl.totalOpex > 0 ? fin.pl.bhCost / fin.pl.totalOpex : 0;

  if (view === "pl") {
    const bh = opex.map((x) => x * bhShare);
    const ovh = opex.map((x, i) => x - bh[i]);
    const ebitda = m.map((x) => x.ebitda);
    const ebit = m.map((x) => x.ebit);
    const tax = m.map((x) => x.tax);
    return [
      { label: "Revenue", lines: [{ name: "Brokerage income", monthly: rev }, { name: "Total Revenue", monthly: rev, isTotal: true }] },
      { label: "Operating Expenses", lines: [
        { name: "BH cost (hiring + direct)", monthly: bh.map((x) => -x), indent: true },
        { name: "Overhead (mid + back office)", monthly: ovh.map((x) => -x), indent: true },
        { name: "EBITDA", monthly: ebitda, isTotal: true },
      ] },
      { label: "Below EBITDA", lines: [
        { name: "Depreciation & amortisation", monthly: dep.map((x) => -x), indent: true },
        { name: "Profit Before Tax (EBIT)", monthly: ebit, isTotal: true },
        { name: `Income tax`, monthly: tax.map((x) => -x), indent: true },
        { name: "Profit After Tax (PAT)", monthly: pat, isTotal: true },
      ] },
    ];
  }

  if (view === "cfs") {
    // Monthly cash-flow build
    const recvYE = fin.bs.receivables, payYE = fin.bs.payables;
    const annualRev = sum(rev) || 1, annualOpex = sum(opex) || 1;
    const capexM = m.map(() => o.capex_annual / 12);
    const dRecv = m.map((_, i) => (cum(rev, i) / annualRev) * recvYE - (i === 0 ? o.receivables : (cum(rev, i - 1) / annualRev) * recvYE));
    const dPay = m.map((_, i) => (cum(opex, i) / annualOpex) * payYE - (i === 0 ? o.payables : (cum(opex, i - 1) / annualOpex) * payYE));
    const opCF = m.map((_, i) => pat[i] + dep[i] - dRecv[i] + dPay[i]);
    const invCF = capexM.map((x) => -x);
    const net = m.map((_, i) => opCF[i] + invCF[i]);
    return [
      { label: "(A) Operating activities", lines: [
        { name: "Profit after tax", monthly: pat, indent: true },
        { name: "Add: Depreciation", monthly: dep, indent: true },
        { name: "Working-capital changes", monthly: m.map((_, i) => -dRecv[i] + dPay[i]), indent: true },
        { name: "Net cash from operations", monthly: opCF, isTotal: true },
      ] },
      { label: "(B) Investing activities", lines: [
        { name: "Capital expenditure", monthly: invCF, indent: true },
        { name: "Net cash from investing", monthly: invCF, isTotal: true },
      ] },
      { label: "(C) Net change & cash", lines: [
        { name: "Net increase / (decrease) in cash", monthly: net, isTotal: true },
        { name: "Closing cash & equivalents", monthly: m.map((x) => x.cash), isTotal: true },
      ] },
    ];
  }

  // Balance Sheet — month-end closing snapshots (cumulative)
  const recvYE = fin.bs.receivables, payYE = fin.bs.payables;
  const annualRev = sum(rev) || 1, annualOpex = sum(opex) || 1;
  const cashM = m.map((x) => x.cash);
  const recvM = m.map((_, i) => (cum(rev, i) / annualRev) * recvYE);
  const payM = m.map((_, i) => (cum(opex, i) / annualOpex) * payYE);
  const fixedM = m.map((_, i) => o.fixed_assets_net + (o.capex_annual - o.depreciation_annual) * ((i + 1) / 12));
  const ocaM = m.map(() => o.other_current_assets);
  const oclM = m.map(() => o.other_current_liabilities);
  const scM = m.map(() => o.share_capital);
  const resM = m.map((x) => o.reserves + x.cumPat);
  const assetsM = m.map((_, i) => cashM[i] + recvM[i] + ocaM[i] + fixedM[i]);
  const eqliabM = m.map((_, i) => payM[i] + oclM[i] + scM[i] + resM[i]);
  return [
    { label: "Assets", lines: [
      { name: "Cash & bank", monthly: cashM, indent: true },
      { name: "Receivables", monthly: recvM, indent: true },
      { name: "Other current assets", monthly: ocaM, indent: true },
      { name: "Fixed assets (net)", monthly: fixedM, indent: true },
      { name: "Total Assets", monthly: assetsM, isTotal: true },
    ] },
    { label: "Equity & Liabilities", lines: [
      { name: "Share capital", monthly: scM, indent: true },
      { name: "Reserves & surplus", monthly: resM, indent: true },
      { name: "Payables", monthly: payM, indent: true },
      { name: "Other current liabilities", monthly: oclM, indent: true },
      { name: "Total Equity & Liabilities", monthly: eqliabM, isTotal: true },
    ] },
  ];
}

export default function EngineStatementTable({
  title, fyLabel, view, fin, opening,
}: {
  title: string; fyLabel: string; view: "pl" | "bs" | "cfs"; fin: Financials; opening: Opening;
}) {
  const sections = buildSections(view, fin, opening);
  return (
    <Card>
      <CardHeader title={title} tag={{ label: fyLabel, tone: "green" }} />
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="fm-table">
            <thead>
              <tr>
                <th className="sticky left-0 bg-navy z-10" style={{ minWidth: 240 }}>Particulars</th>
                {MONTH_LABELS.map((l, i) => <th key={l} className="r">{l}{i >= 9 ? " '28" : " '27"}</th>)}
                <th className="r bg-navy-800">FY Total</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <StatementSection key={sec.label} sec={sec} view={view} />
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function StatementSection({ sec, view }: { sec: Section; view: string }) {
  return (
    <>
      <tr>
        <td colSpan={14} className="bg-navy-50 text-[10.5px] font-bold uppercase tracking-[1.5px] text-navy py-2">{sec.label}</td>
      </tr>
      {sec.lines.map((ln) => {
        // Balance-sheet totals are point-in-time (year-end), flows sum across months.
        const fyTotal = view === "bs" ? ln.monthly[ln.monthly.length - 1] : sum(ln.monthly);
        return (
          <tr key={ln.name} className={ln.isTotal ? "bg-navy-50/40 font-bold border-y border-navy/15" : ""}>
            <td className={`sticky left-0 z-10 ${ln.isTotal ? "bg-navy-50 text-navy" : `bg-white text-ink-muted ${ln.indent ? "pl-5" : ""}`}`}>
              {ln.name}
            </td>
            {ln.monthly.map((v, i) => (
              <td key={i} className={`r font-mono ${ln.isTotal ? "font-bold text-navy" : v < 0 ? "text-edred" : "text-navy"}`}>{Lk(v)}</td>
            ))}
            <td className={`r font-mono font-bold bg-navy-50/30 ${fyTotal < 0 ? "text-edred" : "text-navy"}`}>{LkT(fyTotal)}</td>
          </tr>
        );
      })}
    </>
  );
}
