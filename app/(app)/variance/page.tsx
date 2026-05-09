import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { formatINR, formatPct } from "@/lib/utils";
import PeriodSelector from "@/components/ui/period-selector";

export default async function VariancePage({
  searchParams,
}: {
  searchParams: { period?: string; budget?: string };
}) {
  await requireUser();
  const supabase = createClient();
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single();
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: periods }, { data: budgets }] = await Promise.all([
    supabase
      .from("fiscal_periods")
      .select("id, period_label, start_date")
      .eq("org_id", orgId)
      .order("start_date"),
    supabase
      .from("budgets")
      .select("id, name, fiscal_year")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const defaultPeriod = (periods ?? []).find((p) => p.start_date <= today)?.id;
  const periodId = searchParams.period || defaultPeriod;
  const budgetId = searchParams.budget || budgets?.[0]?.id;

  if (!periods?.length || !budgets?.length || !periodId || !budgetId) {
    return (
      <>
        <PageHeader title="Variance Analysis" subtitle="Actuals vs. budget by account" />
        <Card>
          <CardBody>
            <EmptyState
              icon="📈"
              title="Need a budget to compare against"
              body="Create a budget under Settings → Budgets, or seed one via the seed file. Once a budget exists, this report will show actual vs. budget variance with drivers."
            />
          </CardBody>
        </Card>
      </>
    );
  }

  const { data: variance } = await supabase.rpc("fn_variance_analysis", {
    p_org_id: orgId,
    p_period_id: periodId,
    p_budget_id: budgetId,
  });

  const rows = (variance ?? []) as any[];
  const revenue = rows.filter((r) => r.account_type === "revenue");
  const expense = rows.filter((r) => r.account_type === "expense");

  const totals = {
    actualRev: sum(revenue, "actual"),
    budgetRev: sum(revenue, "budget"),
    actualExp: sum(expense, "actual"),
    budgetExp: sum(expense, "budget"),
  };
  const totalsVarRev = totals.actualRev - totals.budgetRev;
  const totalsVarExp = totals.actualExp - totals.budgetExp;
  const netActual = totals.actualRev - totals.actualExp;
  const netBudget = totals.budgetRev - totals.budgetExp;

  return (
    <>
      <PageHeader
        title="Variance Analysis"
        subtitle="Actuals vs. budget · positive variance on revenue is favourable; positive variance on expense is unfavourable."
        right={<PeriodSelector periods={periods ?? []} active={periodId} basePath="/variance" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        <KpiTile label="Revenue Actual vs Budget" actual={totals.actualRev} budget={totals.budgetRev} positiveIsGood />
        <KpiTile label="Expense Actual vs Budget" actual={totals.actualExp} budget={totals.budgetExp} positiveIsGood={false} />
        <KpiTile label="Net Income Actual vs Budget" actual={netActual} budget={netBudget} positiveIsGood />
      </div>

      <Card>
        <CardHeader title="Revenue · Actual vs Budget" tag={{ label: formatINR(totalsVarRev, { compact: true }), tone: totalsVarRev >= 0 ? "green" : "red" }} />
        <CardBody className="p-0">
          <VarianceTable rows={revenue} />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Expense · Actual vs Budget" tag={{ label: formatINR(totalsVarExp, { compact: true }), tone: totalsVarExp <= 0 ? "green" : "red" }} />
        <CardBody className="p-0">
          <VarianceTable rows={expense} />
        </CardBody>
      </Card>
    </>
  );
}

function sum(rows: any[], key: "actual" | "budget") {
  return rows.reduce((a, r) => a + Number(r[key]), 0);
}

function VarianceTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="px-5 py-6 text-sm text-ink-subtle">No accounts.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="fm-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Name</th>
            <th className="r">Actual</th>
            <th className="r">Budget</th>
            <th className="r">Variance</th>
            <th className="r">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = Number(r.variance);
            return (
              <tr key={r.account_id}>
                <td className="font-mono text-[11px] text-ink-subtle">{r.account_code}</td>
                <td>{r.account_name}</td>
                <td className="r">{formatINR(Number(r.actual), { compact: true })}</td>
                <td className="r">{formatINR(Number(r.budget), { compact: true })}</td>
                <td className={`r font-bold ${v >= 0 ? "text-edgreen" : "text-edred"}`}>
                  {formatINR(v, { compact: true })}
                </td>
                <td className={`r font-bold ${v >= 0 ? "text-edgreen" : "text-edred"}`}>
                  {r.variance_pct != null ? formatPct(Number(r.variance_pct), 1) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KpiTile({ label, actual, budget, positiveIsGood }: { label: string; actual: number; budget: number; positiveIsGood: boolean }) {
  const variance = actual - budget;
  const good = positiveIsGood ? variance >= 0 : variance <= 0;
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden">
      <div className={`kpi-accent ${good ? "green" : "red"}`} />
      <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-ink-subtle">{label}</div>
      <div className="mt-2 font-mono text-[20px] font-semibold leading-none text-navy">
        {formatINR(actual, { compact: true })}
      </div>
      <div className="mt-2 text-[11px] text-ink-subtle">
        Budget: {formatINR(budget, { compact: true })} ·{" "}
        <span className={good ? "text-edgreen font-bold" : "text-edred font-bold"}>
          {variance >= 0 ? "+" : ""}{formatINR(variance, { compact: true })}
        </span>
      </div>
    </div>
  );
}
