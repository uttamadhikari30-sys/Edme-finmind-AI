"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Live data shape used by all three exports (PPT / PDF / Excel).
 */
export type BoardData = {
  orgName: string;
  periodLabel: string;
  generatedAt: string;
  revenue: number;
  expense: number;
  ebitda: number;
  margin: number;
  expenseRatio: number;
  patEst: number;
  jeCount: number;
  monthly: Array<{ period_label: string; revenue: number; expense: number; net_income: number }>;
  verticals: Array<{ code: string; name: string; revenue: number; expense: number; net: number; margin: number }>;
  topInsights: string[];
};

const L = (n: number) => `₹${(n / 1e5).toFixed(2)} L`;
const CR = (n: number) => `₹${(n / 1e7).toFixed(2)} Cr`;

/** Fetch live data needed for the board pack. */
export async function fetchBoardData(): Promise<BoardData> {
  const supabase = createClient();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, organizations(name)")
    .limit(1)
    .single();
  const orgId = (membership as any).org_id as string;
  const orgName = ((membership as any).organizations as any)?.name ?? "Edme Insurance Brokers Limited";

  const today = new Date().toISOString().slice(0, 10);
  const { data: periodNow } = await supabase
    .from("fiscal_periods")
    .select("id, period_label")
    .eq("org_id", orgId)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  let kpis: any = null;
  if (periodNow) {
    const { data } = await supabase.rpc("fn_dashboard_kpis", {
      p_org_id: orgId,
      p_period_id: (periodNow as any).id,
    });
    kpis = data?.[0] ?? null;
  }

  const { data: monthly } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });

  // Vertical breakdown
  const { data: bus } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .order("code");

  const { data: jelRows } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit_amount, credit_amount, business_unit_id,
      chart_of_accounts!inner(account_type),
      journal_entries!inner(status, org_id)
    `)
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.org_id", orgId);

  const byBu = new Map<string, { revenue: number; expense: number }>();
  (jelRows ?? []).forEach((r: any) => {
    const buId = r.business_unit_id;
    if (!buId) return;
    const t = r.chart_of_accounts?.account_type;
    const cur = byBu.get(buId) ?? { revenue: 0, expense: 0 };
    if (t === "revenue") cur.revenue += Number(r.credit_amount) - Number(r.debit_amount);
    if (t === "expense") cur.expense += Number(r.debit_amount) - Number(r.credit_amount);
    byBu.set(buId, cur);
  });

  const verticals = (bus ?? []).map((b: any) => {
    const v = byBu.get(b.id) ?? { revenue: 0, expense: 0 };
    const net = v.revenue - v.expense;
    return {
      code: b.code,
      name: b.name,
      revenue: v.revenue,
      expense: v.expense,
      net,
      margin: v.revenue > 0 ? (net / v.revenue) * 100 : 0,
    };
  });

  const revenue = Number(kpis?.revenue ?? 0);
  const expense = Number(kpis?.expense ?? 0);
  const ebitda = revenue - expense;
  const margin = revenue > 0 ? (ebitda / revenue) * 100 : 0;
  const expenseRatio = revenue > 0 ? (expense / revenue) * 100 : 0;
  const patEst = ebitda > 0 ? ebitda * 0.75 : ebitda;

  const insights: string[] = [];
  if (revenue > 0) {
    insights.push(`Revenue this period: ${L(revenue)} with ${margin.toFixed(1)}% EBITDA margin.`);
    if (margin >= 20) insights.push(`Healthy margins — well above the 15% target threshold.`);
    else if (margin < 10) insights.push(`Margins below target — review overhead allocation.`);
    const topVertical = [...verticals].sort((a, b) => b.revenue - a.revenue)[0];
    if (topVertical && topVertical.revenue > 0)
      insights.push(`Top vertical: ${topVertical.name} at ${L(topVertical.revenue)} (${topVertical.margin.toFixed(1)}% margin).`);
    if (expenseRatio > 80) insights.push(`Expense ratio at ${expenseRatio.toFixed(1)}% — investigate top expense accounts.`);
  } else {
    insights.push("No posted journal entries yet for the current period.");
  }

  return {
    orgName,
    periodLabel: (periodNow as any)?.period_label ?? "—",
    generatedAt: new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" }),
    revenue,
    expense,
    ebitda,
    margin,
    expenseRatio,
    patEst,
    jeCount: kpis?.je_count_posted ?? 0,
    monthly: (monthly ?? []).map((m: any) => ({
      period_label: m.period_label,
      revenue: Number(m.revenue),
      expense: Number(m.expense),
      net_income: Number(m.net_income),
    })),
    verticals,
    topInsights: insights,
  };
}

// ────────────────────────────────────────────────────────────────────────
// PPTX generation via pptxgenjs (loaded from CDN — no npm install needed)
// ────────────────────────────────────────────────────────────────────────
async function loadPptxGen(): Promise<any> {
  const w = window as any;
  if (w.PptxGenJS) return w.PptxGenJS;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/gh/gitbrent/PptxGenJS@3.12.0/dist/pptxgen.bundle.js";
    s.onload = () => resolve(w.PptxGenJS);
    s.onerror = () => reject(new Error("Failed to load pptxgenjs"));
    document.head.appendChild(s);
  });
}

const COLORS = {
  navy: "1C3687",
  navyDark: "0F1E4E",
  red: "ED1B2F",
  green: "00A878",
  gold: "C8952A",
  ink: "11192D",
  inkSubtle: "7888AA",
  bg: "F0F3FB",
  white: "FFFFFF",
};

export async function generateBoardPPT(data: BoardData) {
  const Pptx = await loadPptxGen();
  const pres = new Pptx();
  pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5"
  pres.author = "FINMIND AI";
  pres.company = data.orgName;
  pres.title = `${data.orgName} — Board Pack ${data.periodLabel}`;

  // Slide 1: Cover
  const cover = pres.addSlide();
  cover.background = { color: COLORS.navyDark };
  cover.addText("FINMIND", {
    x: 0.7, y: 0.55, w: 4, h: 0.7,
    fontFace: "Georgia", fontSize: 36, bold: true, color: COLORS.white,
  });
  cover.addText("AI", {
    x: 2.55, y: 0.55, w: 1, h: 0.7,
    fontFace: "Georgia", fontSize: 36, bold: true, color: COLORS.red,
  });
  cover.addText("BOARD PACK", {
    x: 0.7, y: 2.5, w: 12, h: 0.6,
    fontFace: "Calibri", fontSize: 14, color: "FFFFFF80", charSpacing: 8,
  });
  cover.addText(data.orgName, {
    x: 0.7, y: 3.2, w: 12, h: 1.2,
    fontFace: "Georgia", fontSize: 48, bold: true, color: COLORS.white,
  });
  cover.addText(`${data.periodLabel} · MIS Snapshot`, {
    x: 0.7, y: 4.5, w: 12, h: 0.6,
    fontFace: "Calibri", fontSize: 22, color: "FFFFFFAA",
  });
  cover.addText(`Generated ${data.generatedAt} via FINMIND AI`, {
    x: 0.7, y: 6.8, w: 12, h: 0.4,
    fontFace: "Calibri", fontSize: 11, color: COLORS.inkSubtle,
  });

  // Slide 2: Executive summary KPIs
  const s2 = pres.addSlide();
  s2.background = { color: COLORS.bg };
  s2.addText(`Executive Summary — ${data.periodLabel}`, {
    x: 0.5, y: 0.3, w: 12, h: 0.6,
    fontFace: "Georgia", fontSize: 28, bold: true, color: COLORS.navy,
  });

  const kpiTiles = [
    { label: "REVENUE",       value: L(data.revenue),  accent: COLORS.navy },
    { label: "EBITDA",        value: L(data.ebitda),   accent: data.ebitda >= 0 ? COLORS.green : COLORS.red },
    { label: "EBITDA MARGIN", value: `${data.margin.toFixed(1)}%`, accent: data.margin >= 20 ? COLORS.green : data.margin >= 10 ? COLORS.gold : COLORS.red },
    { label: "PAT (EST.)",    value: L(data.patEst),   accent: COLORS.navy },
    { label: "EXPENSE",       value: L(data.expense),  accent: COLORS.red },
    { label: "EXPENSE RATIO", value: `${data.expenseRatio.toFixed(1)}%`, accent: data.expenseRatio < 65 ? COLORS.green : COLORS.gold },
  ];
  const tileW = 1.95;
  const tileH = 1.3;
  const gapX = 0.15;
  const startX = 0.5;
  kpiTiles.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (tileW + gapX) + (col >= 3 ? 6 : 0);
    const y = 1.3 + row * (tileH + gapX);
    s2.addShape("rect", { x, y, w: tileW, h: tileH, fill: { color: COLORS.white }, line: { color: COLORS.bg } });
    s2.addShape("rect", { x, y, w: tileW, h: 0.08, fill: { color: k.accent }, line: { type: "none" } });
    s2.addText(k.label, {
      x: x + 0.15, y: y + 0.18, w: tileW - 0.3, h: 0.3,
      fontFace: "Calibri", fontSize: 9, bold: true, color: COLORS.inkSubtle, charSpacing: 3,
    });
    s2.addText(k.value, {
      x: x + 0.15, y: y + 0.5, w: tileW - 0.3, h: 0.6,
      fontFace: "Consolas", fontSize: 22, bold: true, color: k.accent,
    });
  });

  // Insights bullets
  s2.addText("KEY INSIGHTS", {
    x: 6.7, y: 1.3, w: 6.2, h: 0.3,
    fontFace: "Calibri", fontSize: 11, bold: true, color: COLORS.navy, charSpacing: 4,
  });
  data.topInsights.slice(0, 4).forEach((line, i) => {
    s2.addText(`▸  ${line}`, {
      x: 6.7, y: 1.7 + i * 0.5, w: 6.2, h: 0.45,
      fontFace: "Calibri", fontSize: 13, color: COLORS.ink, bold: false,
    });
  });

  // Slide 3: Monthly trend
  if (data.monthly.length) {
    const s3 = pres.addSlide();
    s3.background = { color: COLORS.bg };
    s3.addText(`Revenue & EBITDA — Monthly Trend`, {
      x: 0.5, y: 0.3, w: 12, h: 0.6,
      fontFace: "Georgia", fontSize: 28, bold: true, color: COLORS.navy,
    });
    s3.addChart(pres.ChartType.bar, [
      { name: "Revenue", labels: data.monthly.map((m) => m.period_label), values: data.monthly.map((m) => Math.round(m.revenue / 1e5)) },
      { name: "Expense", labels: data.monthly.map((m) => m.period_label), values: data.monthly.map((m) => Math.round(m.expense / 1e5)) },
    ], {
      x: 0.5, y: 1.2, w: 12.3, h: 5.5,
      barDir: "col", chartColors: [COLORS.navy, COLORS.red],
      showLegend: true, legendPos: "b", legendFontSize: 11,
      showTitle: false,
      catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
      dataLabelColor: COLORS.ink, dataLabelFontSize: 9,
    });
    s3.addText("Values in INR Lakhs (₹ L)", {
      x: 0.5, y: 7.0, w: 12, h: 0.3,
      fontFace: "Calibri", fontSize: 10, color: COLORS.inkSubtle, italic: true,
    });
  }

  // Slide 4: Vertical performance table
  if (data.verticals.length) {
    const s4 = pres.addSlide();
    s4.background = { color: COLORS.bg };
    s4.addText(`Vertical Performance — ${data.periodLabel}`, {
      x: 0.5, y: 0.3, w: 12, h: 0.6,
      fontFace: "Georgia", fontSize: 28, bold: true, color: COLORS.navy,
    });
    const sortedV = [...data.verticals].sort((a, b) => b.revenue - a.revenue);
    const rows: any[][] = [
      [
        { text: "Code",     options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontFace: "Calibri", fontSize: 11 } },
        { text: "Vertical", options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontFace: "Calibri", fontSize: 11 } },
        { text: "Revenue",  options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontFace: "Calibri", fontSize: 11, align: "right" } },
        { text: "Expense",  options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontFace: "Calibri", fontSize: 11, align: "right" } },
        { text: "Net",      options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontFace: "Calibri", fontSize: 11, align: "right" } },
        { text: "Margin",   options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontFace: "Calibri", fontSize: 11, align: "right" } },
      ],
    ];
    sortedV.forEach((v, i) => {
      const stripe = i % 2 === 0 ? COLORS.white : "F5F8FF";
      rows.push([
        { text: v.code, options: { fill: { color: stripe }, fontFace: "Calibri", fontSize: 11, color: COLORS.navy, bold: true } },
        { text: v.name, options: { fill: { color: stripe }, fontFace: "Calibri", fontSize: 11, color: COLORS.ink } },
        { text: L(v.revenue), options: { fill: { color: stripe }, fontFace: "Consolas", fontSize: 11, color: COLORS.ink, align: "right" } },
        { text: L(v.expense), options: { fill: { color: stripe }, fontFace: "Consolas", fontSize: 11, color: COLORS.ink, align: "right" } },
        { text: L(v.net),     options: { fill: { color: stripe }, fontFace: "Consolas", fontSize: 11, color: v.net >= 0 ? COLORS.green : COLORS.red, bold: true, align: "right" } },
        { text: `${v.margin.toFixed(1)}%`, options: { fill: { color: stripe }, fontFace: "Consolas", fontSize: 11, color: COLORS.ink, align: "right" } },
      ]);
    });
    s4.addTable(rows, {
      x: 0.5, y: 1.2, w: 12.3, h: 5.5,
      colW: [1.0, 4.0, 2.0, 2.0, 1.7, 1.6],
    });
  }

  // Slide 5: Closing
  const close = pres.addSlide();
  close.background = { color: COLORS.navyDark };
  close.addText("Thank you", {
    x: 0.7, y: 2.5, w: 12, h: 1.2,
    fontFace: "Georgia", fontSize: 64, bold: true, color: COLORS.white,
  });
  close.addText("Generated by FINMIND AI · " + data.orgName, {
    x: 0.7, y: 4.0, w: 12, h: 0.6,
    fontFace: "Calibri", fontSize: 16, color: "FFFFFFAA",
  });
  close.addText("Confidential · For internal board use only.", {
    x: 0.7, y: 6.8, w: 12, h: 0.4,
    fontFace: "Calibri", fontSize: 11, color: COLORS.inkSubtle, italic: true,
  });

  const fname = `${data.orgName.replace(/\s+/g, "-")}-BoardPack-${data.periodLabel.replace(/\s+/g, "")}.pptx`;
  await pres.writeFile({ fileName: fname });
}

// ────────────────────────────────────────────────────────────────────────
// Branded PDF (uses styled HTML + window.print)
// ────────────────────────────────────────────────────────────────────────
export function generateBoardPDF(data: BoardData) {
  const monthlyRows = data.monthly
    .map(
      (m) =>
        `<tr><td>${m.period_label}</td><td class="r">${L(m.revenue)}</td><td class="r">${L(m.expense)}</td><td class="r ${
          m.net_income >= 0 ? "ok" : "bad"
        }">${L(m.net_income)}</td></tr>`
    )
    .join("");

  const verticalRows = [...data.verticals]
    .sort((a, b) => b.revenue - a.revenue)
    .map(
      (v) =>
        `<tr><td><b>${v.code}</b></td><td>${v.name}</td><td class="r">${L(v.revenue)}</td><td class="r">${L(
          v.expense
        )}</td><td class="r ${v.net >= 0 ? "ok" : "bad"}"><b>${L(v.net)}</b></td><td class="r">${v.margin.toFixed(1)}%</td></tr>`
    )
    .join("");

  const insights = data.topInsights.map((i) => `<li>${i}</li>`).join("");

  const html = `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${data.orgName} — Board Pack ${data.periodLabel}</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #11192d; font-size: 11px; line-height: 1.4; }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; color: #1C3687; margin: 0; font-size: 28px; }
  h2 { font-family: Georgia, serif; color: #1C3687; margin: 18px 0 8px; font-size: 18px; border-bottom: 2px solid #1C3687; padding-bottom: 4px; }
  .cover { background: linear-gradient(135deg,#050d24,#1C3687); color:#fff; padding: 40px; border-radius:12px; margin-bottom: 24px; page-break-after: always; }
  .cover .title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 48px; font-weight: bold; margin-top: 80px; }
  .cover .sub { font-size: 18px; opacity: 0.7; margin-top: 12px; }
  .cover .gen { font-size: 10px; opacity: 0.5; margin-top: 200px; }
  .cover .brand { font-family: Georgia, serif; font-size: 24px; font-weight: bold; }
  .cover .brand .ai { color: #ED1B2F; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0 20px; }
  .kpi { background: #fff; border: 1px solid #e8ecf8; border-top: 3px solid #1C3687; border-radius: 6px; padding: 10px 14px; }
  .kpi.green { border-top-color: #00A878; }
  .kpi.red { border-top-color: #ED1B2F; }
  .kpi.gold { border-top-color: #C8952A; }
  .kpi .label { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #7888aa; }
  .kpi .value { font-family: Consolas, monospace; font-size: 22px; font-weight: bold; color: #1C3687; margin-top: 4px; }
  .kpi.green .value { color: #00A878; }
  .kpi.red .value { color: #ED1B2F; }
  .kpi.gold .value { color: #C8952A; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; }
  th { background: #1C3687; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; }
  th.r, td.r { text-align: right; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0f3fb; }
  tr:nth-child(even) td { background: #f5f8ff; }
  .ok { color: #00A878; font-weight: bold; }
  .bad { color: #ED1B2F; font-weight: bold; }
  ul { padding-left: 18px; }
  ul li { margin-bottom: 6px; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e8ecf8; font-size: 9px; color: #7888aa; text-align: center; }
</style>
</head>
<body>
  <div class="cover">
    <div class="brand">FINMIND <span class="ai">AI</span></div>
    <div class="title">${data.orgName}</div>
    <div class="sub">BOARD PACK · ${data.periodLabel}</div>
    <div class="gen">Generated ${data.generatedAt} via FINMIND AI · Confidential · Internal use only</div>
  </div>

  <h1>${data.orgName} — Board Pack</h1>
  <div style="color:#7888aa; font-size: 11px;">${data.periodLabel} · MIS Snapshot · Generated ${data.generatedAt}</div>

  <h2>Executive Summary</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">Revenue</div><div class="value">${L(data.revenue)}</div></div>
    <div class="kpi ${data.ebitda >= 0 ? "green" : "red"}"><div class="label">EBITDA</div><div class="value">${L(data.ebitda)}</div></div>
    <div class="kpi ${data.margin >= 20 ? "green" : data.margin >= 10 ? "gold" : "red"}"><div class="label">EBITDA Margin</div><div class="value">${data.margin.toFixed(1)}%</div></div>
    <div class="kpi"><div class="label">PAT (Est.)</div><div class="value">${L(data.patEst)}</div></div>
    <div class="kpi red"><div class="label">Expense</div><div class="value">${L(data.expense)}</div></div>
    <div class="kpi ${data.expenseRatio < 65 ? "green" : "gold"}"><div class="label">Expense Ratio</div><div class="value">${data.expenseRatio.toFixed(1)}%</div></div>
  </div>

  <h2>Key Insights</h2>
  <ul>${insights}</ul>

  <h2>Monthly Trend</h2>
  <table>
    <thead><tr><th>Period</th><th class="r">Revenue</th><th class="r">Expense</th><th class="r">Net Income</th></tr></thead>
    <tbody>${monthlyRows}</tbody>
  </table>

  <h2>Vertical Performance</h2>
  <table>
    <thead><tr><th>Code</th><th>Vertical</th><th class="r">Revenue</th><th class="r">Expense</th><th class="r">Net</th><th class="r">Margin</th></tr></thead>
    <tbody>${verticalRows}</tbody>
  </table>

  <div class="footer">FINMIND AI · ${data.orgName} · Confidential · For internal board use only</div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script>
</body></html>`;

  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) { alert("Pop-up blocked — allow pop-ups for FINMIND AI to export PDF."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ────────────────────────────────────────────────────────────────────────
// Excel (SpreadsheetML — opens in Excel, Google Sheets, Numbers)
// ────────────────────────────────────────────────────────────────────────
export function generateBoardExcel(data: BoardData) {
  const sheet = (name: string, rows: any[][]) => {
    const xmlRows = rows
      .map(
        (r) =>
          `<Row>${r
            .map((cell) => {
              const isNum = typeof cell === "number";
              const t = isNum ? "Number" : "String";
              const v = isNum ? cell : String(cell ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              return `<Cell><Data ss:Type="${t}">${v}</Data></Cell>`;
            })
            .join("")}</Row>`
      )
      .join("");
    return `<Worksheet ss:Name="${name.slice(0, 30)}"><Table>${xmlRows}</Table></Worksheet>`;
  };

  const summaryRows = [
    ["FINMIND AI — Board Pack", data.orgName],
    ["Period", data.periodLabel],
    ["Generated", data.generatedAt],
    [],
    ["KPI", "Value (₹ Lakhs)"],
    ["Revenue", data.revenue / 1e5],
    ["Expense", data.expense / 1e5],
    ["EBITDA", data.ebitda / 1e5],
    ["EBITDA Margin %", Number(data.margin.toFixed(2))],
    ["Expense Ratio %", Number(data.expenseRatio.toFixed(2))],
    ["PAT (Est.)", data.patEst / 1e5],
    ["Posted JEs", data.jeCount],
  ];

  const monthlyRows = [
    ["Period", "Revenue (₹ L)", "Expense (₹ L)", "Net Income (₹ L)"],
    ...data.monthly.map((m) => [
      m.period_label,
      Number((m.revenue / 1e5).toFixed(2)),
      Number((m.expense / 1e5).toFixed(2)),
      Number((m.net_income / 1e5).toFixed(2)),
    ]),
  ];

  const verticalRows = [
    ["Code", "Vertical", "Revenue (₹ L)", "Expense (₹ L)", "Net (₹ L)", "Margin %"],
    ...[...data.verticals]
      .sort((a, b) => b.revenue - a.revenue)
      .map((v) => [
        v.code,
        v.name,
        Number((v.revenue / 1e5).toFixed(2)),
        Number((v.expense / 1e5).toFixed(2)),
        Number((v.net / 1e5).toFixed(2)),
        Number(v.margin.toFixed(2)),
      ]),
  ];

  const insightsRows = [["Key Insights"], ...data.topInsights.map((i) => [i])];

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${sheet("Summary", summaryRows)}
${sheet("Insights", insightsRows)}
${sheet("Monthly Trend", monthlyRows)}
${sheet("Vertical Performance", verticalRows)}
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.orgName.replace(/\s+/g, "-")}-BoardPack-${data.periodLabel.replace(/\s+/g, "")}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
