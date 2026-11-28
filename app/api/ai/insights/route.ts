import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightRequest = {
  page: string;
  context: Record<string, any>;
  language?: "en" | "hi" | "mr";
};

const INSIGHT_PROMPT_SYSTEM = `You are FINMIND AI's strategic intelligence layer for Edme Insurance Brokers Limited — an Indian general insurance broking company.

Your job: read the page context the user is looking at, compare to insurance-broking industry benchmarks, and surface 3–5 short, ACTIONABLE insights.

Each insight must be:
- Specific (quote actual numbers from the context)
- Industry-grounded (compare to Indian insurance broker peers: 25–32% EBITDA margin, 70% expense ratio, 22% salary-to-revenue, 12% admin overhead, 18% PAT margin, ₹25L revenue/HC)
- Actionable (suggest a next step, not just an observation)
- Under 25 words each

Format your response as a JSON array of objects:
[
  { "icon": "💡|⚠️|🎯|📊|🛡|💰", "tone": "good|warn|info|opportunity", "title": "short headline", "body": "the insight + suggested action" }
]

Tone guide:
- 💡 good: positive trend / above benchmark
- ⚠️ warn: below benchmark / risk
- 🎯 opportunity: untapped potential
- 📊 info: neutral observation
- 🛡 protective: compliance / risk-mitigation
- 💰 cash: liquidity / working capital

Return ONLY valid JSON. No prose, no markdown fences.`;

const FALLBACK_INSIGHTS: Record<string, any[]> = {
  dashboard: [
    { icon: "📊", tone: "info", title: "EBITDA margin tracking", body: "Indian insurance brokers average 25–32% EBITDA margin. Watch overhead allocation across verticals." },
    { icon: "🎯", tone: "opportunity", title: "Diversify vertical mix", body: "Keep no single vertical above 35% of revenue to avoid IRDAI concentration risk." },
    { icon: "💰", tone: "info", title: "Working capital discipline", body: "Receivables > 60 days drains liquidity. Push BHs to follow up on M+1 collections." },
  ],
  pl: [
    { icon: "📊", tone: "info", title: "Direct vs indirect cost mix", body: "Front-office cost should be ~50% of total cost; mid-office + support together ~30%. Check the bucket split." },
    { icon: "⚠️", tone: "warn", title: "Salary cost watch", body: "Salary > 25% of revenue is a red flag in broking. Push for revenue-share allocation across verticals." },
  ],
  "admin-expenses": [
    { icon: "📊", tone: "info", title: "Admin overhead benchmark", body: "Industry median is 12% of revenue. Above 15% indicates rent/marketing/travel running hot." },
    { icon: "🎯", tone: "opportunity", title: "Vendor consolidation", body: "Negotiate annual contracts for printing, IT, travel to recover 8–12% from admin spend." },
  ],
  "salary-costs": [
    { icon: "📊", tone: "info", title: "Salary as % of revenue", body: "Healthy bracket: 18–25%. Above 25% suggests headcount expansion outpacing revenue growth." },
    { icon: "🛡", tone: "protective", title: "Mid-office scaling", body: "Mid-office headcount should grow with policies per employee, not total team size." },
  ],
  vertical: [
    { icon: "🎯", tone: "opportunity", title: "Top vertical concentration", body: "If top vertical > 35% of revenue, reduce concentration risk by investing in fastest-growing BHs." },
    { icon: "💡", tone: "good", title: "Renewal cycle", body: "Corporate Q3 (Oct–Dec) drives 40%+ of renewals. Front-load BH effort." },
  ],
  "cash-flow": [
    { icon: "💰", tone: "info", title: "Operating cash conversion", body: "EBITDA-to-cash should be > 80%. Adjustments for WC + tax explain the gap." },
    { icon: "🛡", tone: "protective", title: "Cash buffer", body: "Maintain 1.5× monthly opex as cash reserves for broker operations stability." },
  ],
  vpb: [
    { icon: "💡", tone: "good", title: "Pool sizing", body: "VPB pool at 4.2% of revenue is industry-standard. Track payouts against EBITDA so stretch never erodes margin." },
    { icon: "🎯", tone: "opportunity", title: "Tier ladder design", body: "Stretch >110% should reward 1.25× — drives outsized behaviour from top BHs." },
  ],
  "le-forecast": [
    { icon: "📊", tone: "info", title: "Forecast quality", body: "3-month moving average is solid for run-rate. Strip one-time wins from base for cleaner LE." },
    { icon: "🎯", tone: "opportunity", title: "H2 push", body: "Q3 (Oct–Dec) corporate renewals + Q4 (Jan–Mar) new business = biggest LE upside window." },
  ],
  mom: [
    { icon: "📊", tone: "info", title: "Phasing discipline", body: "Flag any month where actual swings >15% from AOP phasing — usually a timing issue or a slipped renewal." },
    { icon: "🎯", tone: "opportunity", title: "Run-rate check", body: "If YTD run-rate beats AOP, pull forward Q4 pipeline; if behind, re-phase the back half now." },
  ],
  "budget-aop": [
    { icon: "🎯", tone: "opportunity", title: "Stretch vs commit", body: "Hold a committed AOP and a +10% stretch. Board approves commit; BHs chase stretch for VPB." },
    { icon: "⚠️", tone: "warn", title: "Cost creep", body: "Keep total cost growth below revenue growth so EBITDA margin expands year on year." },
  ],
  variance: [
    { icon: "⚠️", tone: "warn", title: "Adverse variance focus", body: "Chase the 3 largest adverse revenue variances first — 80% of the gap usually sits in a few accounts." },
    { icon: "📊", tone: "info", title: "Favourable cost = real?", body: "A favourable cost variance can be a timing lag. Confirm accruals before calling it a saving." },
  ],
  clients: [
    { icon: "🎯", tone: "opportunity", title: "Cross-sell base", body: "Single-product clients are your fastest growth. Target one new line per top-20 account this year." },
    { icon: "🛡", tone: "protective", title: "Retention risk", body: "Clients with falling brokerage YoY are churn signals — schedule a renewal review before expiry." },
  ],
  "client-movement": [
    { icon: "⚠️", tone: "warn", title: "Win-back lost book", body: "Lost clients carried real brokerage. Assign owners to the top lapsed accounts for a win-back push." },
    { icon: "💡", tone: "good", title: "New-addition momentum", body: "Document what won the new accounts and replicate the pitch across the vertical." },
  ],
  "debtors-payables": [
    { icon: "⚠️", tone: "warn", title: "Chase 90+ first", body: "90+ day receivables are the highest write-off risk. Escalate those to the RI/Corporate lead this week." },
    { icon: "💰", tone: "cash", title: "DSO discipline", body: "Every 5 days of DSO reduction frees working capital. Target < 45 days across Corporate and RI books." },
    { icon: "🎯", tone: "opportunity", title: "Prioritise by value", body: "Collect the top 5 outstanding accounts to clear the bulk of exposure fast — focus effort, not volume." },
  ],
  "aop-builder": [
    { icon: "🎯", tone: "opportunity", title: "Pipeline conversion", body: "Lift new-business pipeline above the 60% threshold to convert it into committed brokerage before freeze." },
    { icon: "💡", tone: "good", title: "Renewal base", body: "Price renewals at last year's premium × 1.1 minimum. Renewal brokerage always counts toward AOP." },
    { icon: "📊", tone: "info", title: "Growth benchmark", body: "Indian brokers target 15–20% YoY brokerage growth. Check your plan's growth vs last year's actuals." },
    { icon: "🛡", tone: "protective", title: "Client concentration", body: "No single client should exceed 15% of your vertical's brokerage. Spread the book to de-risk." },
    { icon: "💰", tone: "info", title: "Cost-to-income", body: "Keep your own cost (hiring + direct) under 45% of committed brokerage so overhead still leaves a healthy margin." },
  ],
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const { page, context, language = "en" } = (await req.json()) as InsightRequest;

  // Without API key → return rule-based fallback insights for the page
  if (!apiKey) {
    return NextResponse.json({
      insights: FALLBACK_INSIGHTS[page] ?? FALLBACK_INSIGHTS.dashboard,
      source: "rule-based",
    });
  }

  const langInstr = {
    en: "Respond in English.",
    hi: "Respond in Hindi (Devanagari). Keep technical terms (Revenue, EBITDA, AOP, PAT, VPB) in English.",
    mr: "Respond in Marathi (Devanagari). Keep technical terms in English.",
  }[language];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: INSIGHT_PROMPT_SYSTEM + "\n\n" + langInstr,
        messages: [
          {
            role: "user",
            content: `Page: ${page}\n\nContext (live data):\n${JSON.stringify(context, null, 2)}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        insights: FALLBACK_INSIGHTS[page] ?? FALLBACK_INSIGHTS.dashboard,
        source: "rule-based-fallback",
      });
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    // Strip ```json fences if Claude adds them
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return NextResponse.json({ insights: parsed, source: "claude" });
      }
    } catch {
      // Parsing failed — fall through to fallback
    }

    return NextResponse.json({
      insights: FALLBACK_INSIGHTS[page] ?? FALLBACK_INSIGHTS.dashboard,
      source: "rule-based-fallback",
    });
  } catch {
    return NextResponse.json({
      insights: FALLBACK_INSIGHTS[page] ?? FALLBACK_INSIGHTS.dashboard,
      source: "rule-based-fallback",
    });
  }
}
