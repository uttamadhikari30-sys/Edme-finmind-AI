import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";

export default async function ReconciliationPage() {
  await requireUser();
  const supabase = createClient();

  const { data: recons } = await supabase
    .from("reconciliations")
    .select(`
      id, gl_balance, statement_balance, difference, status, notes, created_at,
      chart_of_accounts(account_code, account_name),
      fiscal_periods(period_label)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = recons ?? [];

  return (
    <>
      <PageHeader
        title="Reconciliation"
        subtitle="Compare GL balances to bank statements and external records to surface differences."
      />

      <Card>
        <CardHeader title="Open & recent reconciliations" tag={{ label: `${rows.length} items`, tone: "navy" }} />
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon="🔗"
              title="No reconciliations on file"
              body="Reconciliations let you compare ledger balances to bank statements and external sources. The schema is ready — populate via the API or seed file."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Period</th>
                    <th className="r">GL Balance</th>
                    <th className="r">Statement</th>
                    <th className="r">Difference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const diff = Number(r.difference);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="font-mono text-[11px] text-ink-subtle mr-2">
                            {r.chart_of_accounts?.account_code}
                          </span>
                          {r.chart_of_accounts?.account_name}
                        </td>
                        <td className="text-ink-muted">{r.fiscal_periods?.period_label}</td>
                        <td className="r">{formatINR(Number(r.gl_balance), { compact: true })}</td>
                        <td className="r">{formatINR(Number(r.statement_balance), { compact: true })}</td>
                        <td className={`r font-bold ${Math.abs(diff) < 0.01 ? "text-edgreen" : "text-edred"}`}>
                          {formatINR(diff, { compact: true })}
                        </td>
                        <td>
                          <span className={`pill ${r.status === "reconciled" ? "pill-green" : r.status === "in_progress" ? "pill-gold" : "pill-red"}`}>
                            {String(r.status).replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
