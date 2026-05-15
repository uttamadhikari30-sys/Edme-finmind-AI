import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import CashFlowClient from "@/components/cash-flow/cash-flow-client";
import AIInsightsCard from "@/components/ai/ai-insights-card";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, end_date")
    .eq("org_id", orgId)
    .order("start_date");

  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = (periods ?? []).find((p) => p.start_date <= today && p.end_date >= today);

  let plRows: any[] = [];
  if (currentPeriod) {
    const { data } = await supabase.rpc("fn_pl_statement", {
      p_org_id: orgId,
      p_period_id: currentPeriod.id,
    });
    plRows = data ?? [];
  }

  const { data: kpiRow } = currentPeriod
    ? await supabase.rpc("fn_dashboard_kpis", { p_org_id: orgId, p_period_id: currentPeriod.id })
    : { data: [] };
  const kpi = (kpiRow as any[])?.[0];

  const revenue = Number(kpi?.revenue ?? 0);
  const expense = Number(kpi?.expense ?? 0);
  const ebitda = revenue - expense;

  return (
    <>
      <PageHeader
        title="Cash Flow"
        subtitle={`Operating, Investing & Financing · ${currentPeriod?.period_label ?? "—"}`}
      />
      <CashFlowClient
        periodLabel={currentPeriod?.period_label ?? "—"}
        ebitda={ebitda}
      />
      <div className="mt-4">
        <AIInsightsCard
          page="cash-flow"
          density="wide"
          context={{
            org: "Edme Insurance Brokers Limited",
            period: currentPeriod?.period_label,
            revenue_inr: revenue,
            expense_inr: expense,
            ebitda_inr: ebitda,
            note: "Insurance broker cash flow. Operating cash conversion benchmark: EBITDA to cash > 80%. Receivables > 60 days = collection risk.",
          }}
        />
      </div>
    </>
  );
}
