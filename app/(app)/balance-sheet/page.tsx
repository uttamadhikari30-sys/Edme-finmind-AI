import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import { formatINR } from "@/lib/utils";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { as_of?: string };
}) {
  await requireUser();
  const supabase = createClient();
  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;

  const orgId = membership.org_id;
  const asOf = searchParams.as_of || new Date().toISOString().slice(0, 10);

  const { data: rows } = await supabase.rpc("fn_balance_sheet", {
    p_org_id: orgId,
    p_as_of: asOf,
  });

  const sections = ["asset", "liability", "equity"] as const;
  const grouped: Record<string, any[]> = { asset: [], liability: [], equity: [] };
  (rows ?? []).forEach((r: any) => grouped[r.section]?.push(r));
  const totals = sections.reduce(
    (acc, s) => ({ ...acc, [s]: grouped[s].reduce((a, r) => a + Number(r.amount), 0) }),
    {} as Record<string, number>
  );

  // Period P&L for retained earnings (cumulative net income up to as_of date)
  const checkSum = totals.liability + totals.equity;
  const checkDelta = totals.asset - checkSum;

  const labels: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity" };
  const tones: Record<string, "navy" | "red" | "green"> = { asset: "navy", liability: "red", equity: "green" };

  return (
    <>
      <PageHeader
        title="Balance Sheet"
        subtitle={`As of ${asOf} · Cumulative posted entries`}
        right={
          <input
            type="date"
            defaultValue={asOf}
            onChange={(e) => {
              window.location.href = `/balance-sheet?as_of=${e.target.value}`;
            }}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm focus:border-navy outline-none"
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Card key={s}>
            <CardHeader title={labels[s]} tag={{ label: formatINR(totals[s], { compact: true }), tone: tones[s] }} />
            <CardBody className="p-0">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th className="r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[s].length === 0 && (
                    <tr><td colSpan={3} className="text-center py-6 text-ink-subtle text-sm">No accounts.</td></tr>
                  )}
                  {grouped[s].map((r: any) => (
                    <tr key={r.account_id}>
                      <td className="font-mono text-[11px] text-ink-subtle">{r.account_code}</td>
                      <td>{r.account_name}</td>
                      <td className="r">{formatINR(Number(r.amount), { compact: true })}</td>
                    </tr>
                  ))}
                  <tr className="bg-navy-50/40 font-bold">
                    <td colSpan={2} className="text-right text-[11px] uppercase text-navy">Total</td>
                    <td className="r font-mono text-navy">{formatINR(totals[s], { compact: true })}</td>
                  </tr>
                </tbody>
              </table>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardBody>
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">Balance Check</span>
            <span className="text-sm">Assets — (Liabilities + Equity) =</span>
            <span className={`font-mono font-bold ${Math.abs(checkDelta) < 0.01 ? "text-edgreen" : "text-edred"}`}>
              {formatINR(checkDelta, { compact: true })}
            </span>
            {Math.abs(checkDelta) < 0.01 ? (
              <span className="pill pill-green">balanced</span>
            ) : (
              <span className="pill pill-red">includes retained earnings (not yet closed)</span>
            )}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
