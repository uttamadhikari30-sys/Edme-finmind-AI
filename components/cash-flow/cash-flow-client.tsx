"use client";

import { useRef } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useCurrency, formatCurrencyLakhs, compactLakhs } from "@/lib/currency";
import ExportButtons from "@/components/ui/export-buttons";

export default function CashFlowClient({
  periodLabel,
  ebitda,
}: {
  periodLabel: string;
  ebitda: number;
}) {
  const currency = useCurrency();
  const tableRef = useRef<HTMLDivElement>(null);

  // Operating Activities (indirect method)
  const ebitdaCash = ebitda;
  const workingCapital = -ebitda * 0.16; // assumed -16% of EBITDA tied up in WC
  const taxPaid = ebitda > 0 ? -ebitda * 0.06 : 0;
  const totalOperating = ebitdaCash + workingCapital + taxPaid;

  // Investing Activities
  const capex = -ebitda * 0.18;
  const investments = ebitda > 0 ? -ebitda * 0.04 : 0;
  const totalInvesting = capex + investments;

  // Financing
  const loanRepayment = ebitda > 0 ? -ebitda * 0.09 : 0;
  const dividend = ebitda > 0 ? -ebitda * 0.025 : 0;
  const totalFinancing = loanRepayment + dividend;

  const netCash = totalOperating + totalInvesting + totalFinancing;

  // AOP placeholders (use ~92% of actual; will become real once budget exists)
  const opAOP = totalOperating * 0.92;
  const invAOP = totalInvesting * 1.08;
  const finAOP = totalFinancing * 0.94;
  const netAOP = opAOP + invAOP + finAOP;

  return (
    <div className="space-y-4">
      {/* 4 KPIs in 2x2 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CashKpi
          label="Operating CF"
          inrValue={totalOperating}
          accent="green"
          emoji="💵"
          deltaPct={opAOP !== 0 ? ((totalOperating - opAOP) / Math.abs(opAOP)) * 100 : 0}
          deltaLabel="vs AOP"
          neutral
        />
        <CashKpi
          label="Investing Outflow"
          inrValue={totalInvesting}
          accent="navy"
          emoji="🏗"
          neutral
        />
        <CashKpi
          label="Financing"
          inrValue={totalFinancing}
          accent="red"
          emoji="🏦"
          neutral
        />
        <CashKpi
          label="Net Cash Position"
          inrValue={netCash}
          accent="gold"
          emoji="💎"
          deltaPct={netAOP !== 0 ? ((netCash - netAOP) / Math.abs(netAOP)) * 100 : 0}
          deltaLabel={netCash >= 0 ? "Strong" : "Watch"}
          neutral={false}
        />
      </div>

      {/* Detailed Cash Flow table */}
      <Card>
        <CardHeader
          title={`Cash Flow Statement · ${periodLabel}`}
          right={<ExportButtons reportName={`Cash Flow · ${periodLabel}`} containerRef={tableRef} />}
        />
        <CardBody className="p-0">
          <div ref={tableRef} className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Category</th>
                  <th>Description</th>
                  <th className="r">Amount ({currency.symbol}L)</th>
                  <th className="r">AOP</th>
                  <th className="r">Variance</th>
                </tr>
              </thead>
              <tbody>
                {/* A. OPERATING */}
                <SectionRow label="A. OPERATING ACTIVITIES" />
                <DataRow desc="Total Operating CF" amount={totalOperating} aop={opAOP} currency={currency} bold colorBold />
                <DataRow desc="EBITDA (Cash)" amount={ebitdaCash} aop={ebitdaCash * 0.95} currency={currency} indent />
                <DataRow desc="Working Capital Changes" amount={workingCapital} aop={workingCapital * 1.22} currency={currency} indent />
                <DataRow desc="Tax Paid" amount={taxPaid} aop={taxPaid * 1.04} currency={currency} indent />

                {/* B. INVESTING */}
                <SectionRow label="B. INVESTING ACTIVITIES" />
                <DataRow desc="Total Investing" amount={totalInvesting} aop={invAOP} currency={currency} bold colorBold />
                <DataRow desc="Capital Expenditure" amount={capex} aop={capex * 1.18} currency={currency} indent />
                <DataRow desc="Investments" amount={investments} aop={investments} currency={currency} indent />

                {/* C. FINANCING */}
                <SectionRow label="C. FINANCING ACTIVITIES" />
                <DataRow desc="Total Financing" amount={totalFinancing} aop={finAOP} currency={currency} bold colorBold />
                <DataRow desc="Loan Repayment" amount={loanRepayment} aop={loanRepayment * 0.95} currency={currency} indent />
                <DataRow desc="Dividend" amount={dividend} aop={dividend * 0.89} currency={currency} indent />

                {/* NET CASH FLOW */}
                <tr className="bg-edgreen-50/60 border-y-2 border-edgreen/40 font-bold">
                  <td colSpan={2} className="uppercase tracking-[1.5px] text-[12px] text-edgreen pl-4">
                    <span className="inline-block w-1 h-5 bg-edgreen rounded mr-2 align-middle" />
                    NET CASH FLOW
                  </td>
                  <td className={`r font-mono text-[14px] ${netCash >= 0 ? "text-edgreen" : "text-edred"}`}>
                    {compactLakhs(netCash, currency)}
                  </td>
                  <td className="r font-mono text-ink-muted">
                    {compactLakhs(netAOP, currency)}
                  </td>
                  <td className={`r font-mono ${netCash >= netAOP ? "text-edgreen" : "text-edred"}`}>
                    {netCash - netAOP >= 0 ? "+" : ""}
                    {compactLakhs(netCash - netAOP, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="text-[10.5px] text-ink-subtle italic px-2">
        Cash flow uses indirect method · Working Capital, Capex, and Financing flows assume industry-standard ratios
        of EBITDA. Replace with real Treasury & AP/AR data via{" "}
        <a href="/ledger-upload" className="text-navy font-semibold hover:underline">Ledger Upload</a>.
      </div>
    </div>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={5} className="bg-navy-50/60 text-[10.5px] font-bold uppercase tracking-[1.5px] text-navy py-2 pl-3">
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  desc,
  amount,
  aop,
  currency,
  bold,
  colorBold,
  indent,
}: {
  desc: string;
  amount: number;
  aop: number;
  currency: ReturnType<typeof useCurrency>;
  bold?: boolean;
  colorBold?: boolean;
  indent?: boolean;
}) {
  const variance = amount - aop;
  const positive = variance >= 0;
  return (
    <tr>
      <td></td>
      <td className={`${bold ? "font-bold text-navy" : indent ? "pl-6 text-ink-muted" : "text-ink-muted"}`}>{desc}</td>
      <td
        className={`r font-mono ${
          colorBold
            ? amount >= 0
              ? "text-edgreen font-bold"
              : "text-edred font-bold"
            : amount >= 0
            ? "text-navy"
            : "text-edred"
        }`}
      >
        {compactLakhs(amount, currency)}
      </td>
      <td className="r font-mono text-ink-subtle">{compactLakhs(aop, currency)}</td>
      <td className={`r font-mono ${positive ? "text-edgreen font-semibold" : "text-edred font-semibold"}`}>
        {positive ? "+" : ""}
        {compactLakhs(variance, currency)}
      </td>
    </tr>
  );
}

function CashKpi({
  label,
  inrValue,
  accent,
  emoji,
  deltaPct,
  deltaLabel,
  neutral,
}: {
  label: string;
  inrValue: number;
  accent: "green" | "navy" | "red" | "gold";
  emoji?: string;
  deltaPct?: number;
  deltaLabel?: string;
  neutral?: boolean;
}) {
  const positive = inrValue >= 0;
  const valueColor = neutral
    ? accent === "green"
      ? "text-edgreen"
      : accent === "navy"
      ? "text-navy"
      : accent === "red"
      ? "text-edred"
      : "text-gold"
    : positive
    ? "text-edgreen"
    : "text-edred";

  return (
    <div className="bg-white rounded-[14px] p-6 border border-[var(--border)] shadow-soft relative overflow-hidden hover:-translate-y-0.5 hover:shadow-card transition-all">
      <div className={`kpi-accent ${accent}`} />
      {emoji && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[60px] opacity-[0.06] pointer-events-none leading-none select-none">
          {emoji}
        </div>
      )}
      <div className="text-[11px] font-bold uppercase tracking-[1px] text-ink-subtle mb-3">{label}</div>
      <div className={`font-mono text-[32px] font-semibold leading-none ${valueColor}`}>
        {inrValue < 0 ? "−" : ""}
        {formatCurrencyLakhs(Math.abs(inrValue), useCurrency())}
      </div>
      {(deltaPct !== undefined || deltaLabel) && (
        <div
          className={`mt-3 inline-block px-2.5 py-1 rounded text-[11px] font-bold ${
            (deltaPct ?? 0) >= 0 ? "bg-edgreen-50 text-edgreen" : "bg-edred-50 text-edred"
          }`}
        >
          {deltaPct !== undefined && (deltaPct >= 0 ? "▲" : "▼")} {deltaLabel}
          {deltaPct !== undefined && ` ${Math.abs(deltaPct).toFixed(0)}%`}
        </div>
      )}
    </div>
  );
}
