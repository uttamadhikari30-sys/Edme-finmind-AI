import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lang = "en" | "hi" | "mr";

const LANG_INSTRUCTION: Record<Lang, string> = {
  en: "Respond in English only. Use a warm, professional tone suitable for a CFO assistant.",
  hi: "केवल हिन्दी में उत्तर दें (Devanagari script)। CFO सहायक के लिए उपयुक्त गर्म, पेशेवर लहजे में। English के technical financial terms (Revenue, EBITDA, AOP, PAT, VPB, margin) रख सकती हैं।",
  mr: "केवळ मराठीत उत्तर द्या (Devanagari script). CFO सहायकासाठी योग्य उबदार, व्यावसायिक लहजेत. English चे technical financial terms (Revenue, EBITDA, AOP, PAT, VPB, margin) ठेवू शकता.",
};

const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi", mr: "Marathi" };

async function buildContext(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(name, fiscal_year_start_month)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) return "";

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

    let kpi: any = null;
    if (periodNow) {
      const { data } = await supabase.rpc("fn_dashboard_kpis", {
        p_org_id: orgId,
        p_period_id: periodNow.id,
      });
      kpi = data?.[0] ?? null;
    }

    const { data: monthly } = await supabase.rpc("fn_monthly_pl", { p_org_id: orgId });
    const ytdRev = (monthly ?? []).reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
    const ytdExp = (monthly ?? []).reduce((s: number, r: any) => s + Number(r.expense || 0), 0);
    const ytdNet = ytdRev - ytdExp;
    const ytdMargin = ytdRev > 0 ? (ytdNet / ytdRev) * 100 : 0;

    const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

    const monthlyLine = (monthly ?? [])
      .filter((m: any) => Number(m.revenue) > 0)
      .map((m: any) => `${m.period_label}: rev ${L(Number(m.revenue))}, ebitda ${L(Number(m.net_income))}`)
      .join(" | ");

    return [
      `Organization: ${orgName} (insurance broker, Indian Rupee, fiscal year April–March).`,
      `User role: ${(membership as any).role}.`,
      `Current period: ${periodNow?.period_label ?? "—"}.`,
      kpi
        ? `Current period KPIs — Revenue: ${L(Number(kpi.revenue))}, Expense: ${L(Number(kpi.expense))}, EBITDA/Net: ${L(Number(kpi.net_income))}, Margin: ${Number(kpi.gross_margin_pct).toFixed(1)}%, Expense ratio: ${Number(kpi.expense_ratio_pct).toFixed(1)}%, Posted JEs: ${kpi.je_count_posted}, Draft JEs: ${kpi.je_count_draft}.`
        : "No KPIs for current period.",
      `YTD totals — Revenue: ${L(ytdRev)}, Expense: ${L(ytdExp)}, EBITDA: ${L(ytdNet)}, Margin: ${ytdMargin.toFixed(1)}%.`,
      monthlyLine ? `Monthly breakdown: ${monthlyLine}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured", fallback: true },
      { status: 503 }
    );
  }

  const { question, lang = "en", history = [] } = (await req.json()) as {
    question: string;
    lang: Lang;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!question || question.trim().length === 0) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  const businessContext = await buildContext();

  const system = `You are Maya, the AI voice assistant for FINMIND AI — the MIS & finance intelligence platform of Edme Insurance Brokers Limited.

Your job is to give crisp, accurate answers to the CFO, CEO, Finance team, and Business Heads. You speak as if you're at a board meeting — knowledgeable, calm, and direct.

LANGUAGE: ${LANG_NAME[lang as Lang]}. ${LANG_INSTRUCTION[lang as Lang]}

LENGTH: Keep answers to 1–3 sentences (under 60 words). Your response will be read aloud, so favor flowing prose over bullet lists. Round numbers (e.g. "₹342 Lakhs" not "₹342,18,495").

NUMBERS: Use Indian financial conventions — Lakhs (L), Crores (Cr). Always include the unit. Quote actual figures from the business context below when relevant.

DOMAIN: You can answer about Revenue, EBITDA, EBITDA Margin, PAT, AOP achievement, vertical/business-head performance, VPB (Variable Pay), Cash Flow, Latest Estimate (LE), insurance market trends. If asked something outside finance/MIS, politely redirect.

LIVE BUSINESS DATA (use these when relevant):
${businessContext || "(No live data available — answer generically about finance/MIS concepts.)"}

If the user just greets you, greet them back warmly and offer to share key numbers.`;

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
        max_tokens: 300,
        system,
        messages: [
          ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: question },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Anthropic API ${res.status}: ${errText.slice(0, 200)}`, fallback: true },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();

    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Network error", fallback: true },
      { status: 500 }
    );
  }
}
