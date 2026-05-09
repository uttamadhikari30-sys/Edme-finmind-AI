import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { formatINR, formatPct } from "@/lib/utils";
import PeriodSelector from "@/components/ui/period-selector";

export default async function PLPage({
  searchParams,
}: {
  searchParams: { period?: string };
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

  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date, status")
    .eq("org_id", orgId)
    .order("start_date");

  const today = new Date().toISOString().slice(0, 10);
  const defaultPeriod = (periods ?? []).find(
    (p) => p.start_date <= today
  )?.id;
  const periodId = searchParams.period || defaultPeriod;

  if (!periodId) {
    return (
      <>
        <PageHeader title="P&L Statement" subtitle="Period income and expenses" />
        <Card><CardBody><EmptyState title="No fiscal periods yet" body="Set up your fiscal periods first." /></CardBody></Card>
      </>
    );
  }

  const { data: pl } = await supabase.rpc("fn_pl_statement", { p_org_id: orgId, p_period_id: periodId });
  const rows = pl ?? [];

  const revenue = rows.filter((r: any) => r.section === "revenue");
  const expense = rows.filter((r: any) => r.section === "expense");
  const totalRevenue = revenue.reduce((a: number, r: any) => a + Number(r.amount), 0);
  const totalExpense = expense.reduce((a: number, r: any) => a + Number(r.amount), 0);
  const netIncome = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  return (
    <>
      <PageHeader
        title="P&L Statement"
        subtitle={`${(periods ?? []).find((p) => p.id === periodId)?.period_label ?? ""} · Posted entries only`}
        right={<PeriodSelector periods={periods ?? []} active={periodId} basePath="/pl" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        <SummaryTile label="Revenue" value={formatINR(totalRevenue, { compact: true })} tone="navy" />
        <SummaryTile label="Expense" value={formatINR(totalExpense, { compact: true })} tone="red" />
        <SummaryTile label="Net Income" value={formatINR(netIncome, { compact: true })} tone={netIncome >= 0 ? "green" : "red"} sub={`Margin ${formatPct(margin, 1)}`} />
      </div>

      <Card>
        <CardHeader title="Income Statement" />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Name</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={3} className="bg-navy-50 font-bold uppercase tracking-wider text-[10px] text-navy">Revenue</td></tr>
              {revenue.map((r: any) => (
                <tr key={r.account_id}>
                  <td className="font-mono text-[11px] text-ink-subtle">{r.account_code}</td>
                  <td>{r.account_name}</td>
                  <td className="r">{formatINR(Number(r.amount), { compact: true })}</td>
                </tr>
              ))}
              <tr className="bg-navy-50/40 font-bold">
                <td colSpan={2} className="text-right text-[11px] uppercase text-navy">Total Revenue</td>
                <td className="r font-mono text-navy">{formatINR(totalRevenue, { compact: true })}</td>
              </tr>

              <tr><td colSpan={3} className="bg-edred-50 font-bold uppercase tracking-wider text-[10px] text-edred">Expense</td></tr>
              {expense.map((r: any) => (
                <tr key={r.account_id}>
                  <td className="font-mono text-[11px] text-ink-subtle">{r.account_code}</td>
                  <td>{r.account_name}</td>
                  <td className="r">{formatINR(Number(r.amount), { compact: true })}</td>
                </tr>
              ))}
              <tr className="bg-edred-50/40 font-bold">
                <td colSpan={2} className="text-right text-[11px] uppercase text-edred">Total Expense</td>
                <td className="r font-mono text-edred">{formatINR(totalExpense, { compact: true })}</td>
              </tr>

              <tr className={`font-bold ${netIncome >= 0 ? "bg-edgreen-50/60" : "bg-edred-50/60"}`}>
                <td colSpan={2} className="text-right text-[11px] uppercase tracking-wider">Net Income</td>
                <td className={`r font-mono ${netIncome >= 0 ? "text-edgreen" : "text-edred"}`}>
                  {formatINR(netIncome, { compact: true })}
                </td>
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}

function SummaryTile({ label, value, tone, sub }: { label: string; value: string; tone: "navy" | "red" | "green"; sub?: string }) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden">
      <div className={`kpi-accent ${tone}`} />
      <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-ink-subtle">{label}</div>
      <div className={`mt-2 font-mono text-[24px] font-semibold leading-none ${tone === "green" ? "text-edgreen" : tone === "red" ? "text-edred" : "text-navy"}`}>{value}</div>
      {sub && <div className="mt-2 text-[10.5px] text-ink-subtle">{sub}</div>}
    </div>
  );
}
