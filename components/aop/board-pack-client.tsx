"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type DeckData = {
  org: string;
  planFy: string;
  basisFy: string;
  status: string;
  totals: { brokerage: number; cost: number; profit: number; margin: number; lyBrokerage: number; growth: number; verticals: number };
  verticals: { name: string; brokerage: number; cost: number; profit: number; margin: number; growth: number }[];
  pl: { revenue: number; ebitda: number; ebitdaMargin: number; depreciation: number; ebit: number; tax: number; pat: number; patMargin: number };
  bs: { totalAssets: number; cash: number; receivables: number; fixedAssets: number; payables: number; equity: number; check: number };
  cf: { operatingCF: number; investingCF: number; netCash: number; closingCash: number };
  hasFinancials: boolean;
};

const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;
const Lp = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
// Brand colors for the deck
const NAVY = "1C3687", RED = "ED1B2F", GREEN = "00875A", GOLD = "D68910", INK = "0B1220", MUT = "64748B", BG = "F4F6FB";

export default function BoardPackClient({ deck }: { deck: DeckData }) {
  const [busy, setBusy] = useState(false);

  async function downloadPPT() {
    setBusy(true);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const p = new PptxGenJS();
      p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
      p.author = "FINMIND AI";
      p.company = deck.org;
      const W = 13.33;
      const money = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

      // ── Slide 1: Cover ──
      const s1 = p.addSlide();
      s1.background = { color: NAVY };
      s1.addShape(p.ShapeType.rect, { x: 0, y: 5.0, w: W, h: 0.09, fill: { color: RED } });
      s1.addText("ANNUAL OPERATING PLAN", { x: 0.8, y: 2.1, w: 11.7, h: 0.6, fontSize: 34, bold: true, color: "FFFFFF", fontFace: "Arial" });
      s1.addText(`${deck.planFy}  ·  Board Approval Pack`, { x: 0.8, y: 2.95, w: 11.7, h: 0.5, fontSize: 20, color: "D7DEF5" });
      s1.addText(deck.org, { x: 0.8, y: 3.5, w: 11.7, h: 0.5, fontSize: 16, color: "AAB6E0" });
      s1.addText(`Status: ${deck.status.toUpperCase()}`, { x: 0.8, y: 5.25, w: 6, h: 0.4, fontSize: 12, bold: true, color: deck.status === "approved" ? "7CF0C0" : "FFD98A" });
      s1.addText(`Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · FINMIND AI`, { x: 7.0, y: 5.25, w: 5.5, h: 0.4, fontSize: 11, color: "8EA0D6", align: "right" });

      // ── Slide 2: Executive summary ──
      const s2 = p.addSlide();
      slideTitle(p, s2, "Executive Summary", deck.planFy);
      const tiles: [string, string, string][] = [
        ["Committed Brokerage", money(deck.totals.brokerage), GREEN],
        ["Total Cost", money(deck.totals.cost), RED],
        ["AOP Profit", money(deck.totals.profit), NAVY],
        ["Margin", `${deck.totals.margin.toFixed(1)}%`, NAVY],
        [`Growth vs ${deck.basisFy}`, Lp(deck.totals.growth), deck.totals.growth >= 0 ? GREEN : RED],
        ["Verticals", `${deck.totals.verticals}`, GOLD],
      ];
      tiles.forEach((t, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 0.8 + col * 4.0, y = 1.7 + row * 1.9;
        s2.addShape(p.ShapeType.roundRect, { x, y, w: 3.7, h: 1.6, fill: { color: BG }, line: { color: "E2E8F5", width: 1 }, rectRadius: 0.1 });
        s2.addText(t[0].toUpperCase(), { x: x + 0.25, y: y + 0.22, w: 3.2, h: 0.4, fontSize: 11, bold: true, color: MUT });
        s2.addText(t[1], { x: x + 0.25, y: y + 0.6, w: 3.2, h: 0.7, fontSize: 26, bold: true, color: t[2] });
      });

      // ── Slide 3: AOP by Vertical ──
      const s3 = p.addSlide();
      slideTitle(p, s3, "AOP by Vertical", deck.planFy);
      const head = ["Vertical", "Brokerage", "Cost", "AOP Profit", "Margin", `Growth`].map((h) => cell(h, { bold: true, color: "FFFFFF", fill: NAVY, align: h === "Vertical" ? "left" : "right" }));
      const vrows = deck.verticals.map((v) => [
        cell(v.name, { align: "left" }),
        cell(money(v.brokerage), { align: "right" }),
        cell(money(v.cost), { align: "right", color: MUT }),
        cell(money(v.profit), { align: "right", bold: true, color: v.profit >= 0 ? GREEN : RED }),
        cell(`${v.margin.toFixed(1)}%`, { align: "right" }),
        cell(Lp(v.growth), { align: "right", color: v.growth >= 0 ? GREEN : RED }),
      ]);
      const totalRow = [
        cell("Company Total", { bold: true, align: "left", fill: "EEF2FB" }),
        cell(money(deck.totals.brokerage), { bold: true, align: "right", fill: "EEF2FB" }),
        cell(money(deck.totals.cost), { bold: true, align: "right", fill: "EEF2FB" }),
        cell(money(deck.totals.profit), { bold: true, align: "right", fill: "EEF2FB", color: NAVY }),
        cell(`${deck.totals.margin.toFixed(1)}%`, { bold: true, align: "right", fill: "EEF2FB" }),
        cell(Lp(deck.totals.growth), { bold: true, align: "right", fill: "EEF2FB" }),
      ];
      s3.addTable([head, ...vrows, totalRow], {
        x: 0.6, y: 1.6, w: 12.1, colW: [4.3, 1.75, 1.6, 1.75, 1.3, 1.4],
        fontSize: 11, border: { type: "solid", color: "E2E8F5", pt: 1 }, valign: "middle", rowH: 0.34,
      });

      // ── Slide 4: AOP P&L ──
      const s4 = p.addSlide();
      slideTitle(p, s4, "AOP Profit & Loss", deck.planFy);
      const pl = deck.pl;
      const plRows: [string, number, string, boolean?][] = [
        ["Revenue (Brokerage)", pl.revenue, NAVY, true],
        ["EBITDA", pl.ebitda, GREEN, true],
        ["Depreciation", -pl.depreciation, RED],
        ["EBIT", pl.ebit, NAVY, true],
        ["Tax", -pl.tax, RED],
        ["PAT", pl.pat, NAVY, true],
      ];
      s4.addTable(
        plRows.map(([l, v, c, b]) => [cell(l, { align: "left", bold: !!b }), cell((v < 0 ? "−" : "") + money(Math.abs(v)), { align: "right", bold: !!b, color: c })]),
        { x: 1.2, y: 1.7, w: 7.0, colW: [4.6, 2.4], fontSize: 13, border: { type: "solid", color: "E2E8F5", pt: 1 }, rowH: 0.42, valign: "middle" }
      );
      s4.addShape(p.ShapeType.roundRect, { x: 8.6, y: 1.7, w: 3.9, h: 1.4, fill: { color: BG }, line: { color: "E2E8F5", width: 1 }, rectRadius: 0.1 });
      s4.addText("EBITDA MARGIN", { x: 8.8, y: 1.85, w: 3.5, h: 0.3, fontSize: 11, bold: true, color: MUT });
      s4.addText(`${pl.ebitdaMargin.toFixed(1)}%`, { x: 8.8, y: 2.15, w: 3.5, h: 0.8, fontSize: 30, bold: true, color: GREEN });
      s4.addShape(p.ShapeType.roundRect, { x: 8.6, y: 3.3, w: 3.9, h: 1.4, fill: { color: BG }, line: { color: "E2E8F5", width: 1 }, rectRadius: 0.1 });
      s4.addText("PAT MARGIN", { x: 8.8, y: 3.45, w: 3.5, h: 0.3, fontSize: 11, bold: true, color: MUT });
      s4.addText(`${pl.patMargin.toFixed(1)}%`, { x: 8.8, y: 3.75, w: 3.5, h: 0.8, fontSize: 30, bold: true, color: NAVY });

      // ── Slide 5: Balance Sheet & Cash Flow ──
      const s5 = p.addSlide();
      slideTitle(p, s5, "Balance Sheet & Cash Flow", deck.planFy);
      if (deck.hasFinancials) {
        const bs = deck.bs, cf = deck.cf;
        s5.addText("Balance Sheet (Closing)", { x: 0.8, y: 1.55, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: NAVY });
        s5.addTable([
          ["Total Assets", money(bs.totalAssets)], ["  Cash", money(bs.cash)], ["  Receivables", money(bs.receivables)],
          ["  Fixed Assets", money(bs.fixedAssets)], ["Payables", money(bs.payables)], ["Equity", money(bs.equity)],
        ].map(([l, v], i) => [cell(l, { align: "left", bold: i === 0 }), cell(v, { align: "right", bold: i === 0 })]),
          { x: 0.8, y: 1.95, w: 5.5, colW: [3.5, 2.0], fontSize: 12, border: { type: "solid", color: "E2E8F5", pt: 1 }, rowH: 0.38 });
        s5.addText("Cash Flow", { x: 7.0, y: 1.55, w: 5.5, h: 0.35, fontSize: 14, bold: true, color: NAVY });
        s5.addTable([
          ["Operating Cash Flow", money(cf.operatingCF)], ["Investing (Capex)", money(cf.investingCF)],
          ["Net Cash Flow", money(cf.netCash)], ["Closing Cash", money(cf.closingCash)],
        ].map(([l, v], i) => [cell(l, { align: "left", bold: i === 3 }), cell(v, { align: "right", bold: i === 3, color: i === 3 ? NAVY : INK })]),
          { x: 7.0, y: 1.95, w: 5.5, colW: [3.5, 2.0], fontSize: 12, border: { type: "solid", color: "E2E8F5", pt: 1 }, rowH: 0.42 });
      } else {
        s5.addText("Enter the opening balance sheet in AOP Financials to include the full Balance Sheet & Cash Flow here.", { x: 0.8, y: 2.3, w: 11.5, h: 1, fontSize: 15, color: MUT, italic: true });
      }

      // ── Slide 6: Approval ──
      const s6 = p.addSlide();
      s6.background = { color: NAVY };
      s6.addText("Board Approval", { x: 0.8, y: 1.6, w: 11.7, h: 0.7, fontSize: 30, bold: true, color: "FFFFFF" });
      s6.addText(`We recommend the Board approve the ${deck.planFy} Annual Operating Plan: committed brokerage ${money(deck.totals.brokerage)}, AOP profit ${money(deck.totals.profit)} at ${deck.totals.margin.toFixed(1)}% margin.`,
        { x: 0.8, y: 2.5, w: 11.0, h: 1.0, fontSize: 15, color: "D7DEF5", lineSpacingMultiple: 1.3 });
      const signs = ["Chief Executive Officer", "Chief Financial Officer", "Chairperson"];
      signs.forEach((role, i) => {
        const x = 0.9 + i * 4.0;
        s6.addShape(p.ShapeType.line, { x, y: 5.2, w: 3.3, h: 0, line: { color: "8EA0D6", width: 1 } });
        s6.addText(role, { x, y: 5.3, w: 3.3, h: 0.4, fontSize: 12, color: "AAB6E0" });
      });

      await p.writeFile({ fileName: `AOP-Board-Pack-${deck.planFy.replace(/\s/g, "")}.pptx` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[13.5px] font-bold text-navy">Board-approval deck · {deck.planFy}</div>
            <div className="text-[11.5px] text-ink-muted">6 slides — cover, executive summary, AOP by vertical, P&L, balance sheet &amp; cash flow, approval. Downloads as an editable PowerPoint.</div>
          </div>
          <button onClick={downloadPPT} disabled={busy}
            className="px-5 py-2 rounded-lg bg-edred text-white text-[13px] font-semibold hover:bg-edred-600 disabled:opacity-60">
            {busy ? "Building deck…" : "⬇ Download Board PPT (.pptx)"}
          </button>
        </CardBody>
      </Card>

      {/* On-screen preview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Committed Brokerage" value={L(deck.totals.brokerage)} tone="green" />
        <Tile label="Total Cost" value={L(deck.totals.cost)} tone="red" />
        <Tile label="AOP Profit" value={L(deck.totals.profit)} tone="navy" sub={`${deck.totals.margin.toFixed(1)}% margin`} />
        <Tile label={`Growth vs ${deck.basisFy}`} value={Lp(deck.totals.growth)} tone={deck.totals.growth >= 0 ? "green" : "red"} />
      </div>

      <Card>
        <CardHeader title="AOP by Vertical" tag={{ label: `${deck.verticals.length} verticals`, tone: "navy" }} />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead><tr><th>Vertical</th><th className="r">Brokerage</th><th className="r">Cost</th><th className="r">Profit</th><th className="r">Margin</th><th className="r">Growth</th></tr></thead>
            <tbody>
              {deck.verticals.map((v) => (
                <tr key={v.name}>
                  <td className="font-semibold">{v.name}</td>
                  <td className="r text-edgreen font-semibold">{L(v.brokerage)}</td>
                  <td className="r text-ink-subtle">{L(v.cost)}</td>
                  <td className={`r font-semibold ${v.profit >= 0 ? "text-navy" : "text-edred"}`}>{L(v.profit)}</td>
                  <td className="r">{v.margin.toFixed(1)}%</td>
                  <td className={`r font-semibold ${v.growth >= 0 ? "text-edgreen" : "text-edred"}`}>{Lp(v.growth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {!deck.hasFinancials && (
        <p className="text-[11.5px] text-ink-muted">
          Tip: enter the opening balance sheet in <strong>AOP Financials</strong> to include the full Balance Sheet &amp; Cash Flow slide in the deck.
        </p>
      )}
    </div>
  );
}

// ── PPTX helpers ──
function cell(text: string, opts: { align?: "left" | "right" | "center"; bold?: boolean; color?: string; fill?: string; fontSize?: number } = {}) {
  const options: any = {
    align: opts.align ?? "left",
    bold: !!opts.bold,
    color: opts.color ?? INK,
    fontSize: opts.fontSize ?? 11,
    valign: "middle",
  };
  if (opts.fill) options.fill = { color: opts.fill };
  return { text: String(text), options };
}

function slideTitle(p: any, s: any, title: string, sub: string) {
  s.addText(title, { x: 0.7, y: 0.35, w: 9, h: 0.5, fontSize: 22, bold: true, color: NAVY, fontFace: "Arial" });
  s.addText(sub, { x: 9.6, y: 0.45, w: 3.0, h: 0.4, fontSize: 12, color: MUT, align: "right" });
  s.addShape(p.ShapeType.rect, { x: 0.7, y: 1.05, w: 11.9, h: 0.03, fill: { color: RED } });
}

function Tile({ label, value, tone, sub }: { label: string; value: string; tone: "navy" | "green" | "red" | "gold"; sub?: string }) {
  const color = { navy: "text-navy", green: "text-edgreen", red: "text-edred", gold: "text-gold" }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[20px] font-bold mt-0.5 ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-ink-muted mt-0.5">{sub}</div>}
      </CardBody>
    </Card>
  );
}
