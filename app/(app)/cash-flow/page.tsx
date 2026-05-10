import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { formatINRUnit } from "@/lib/utils";
import PeriodSelector from "@/components/ui/period-selector";

export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: { period?: string };
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

  const { data: periods } = await supabase
    .from("fiscal_periods")
    .select("id, period_label, start_date")
    .eq("org_id", orgId)
    .order("start_date");

  const today = new Date().toISOString().slice(0, 10);
  const defaultPeriod = (periods ?? []).find((p) => p.start_date <= today)?.id;
  const periodId = searchParams.period || defaultPeriod;

  if (!periodId) {
    return (
      <>
        <PageHeader title="Cash Flow Statement" subtitle="Operating · Investing · Financing" />
        <Card>
          <CardBody>
            <EmptyState title="No fiscal periods yet" body="Set up your fiscal periods first." />
          </CardBody>
        </Card>
      </>
    );
  }

  const { data: rows } = await supabase.rpc("fn_cash_flow", {
    p_org_id: orgId,
    p_period_id: periodId,
  });

  type Row = { section: string; account_code: string; account_name: string; amount: number };
  const all = (rows ?? []) as Row[];

  const sections = ["operating", "investing", "financing"] as const;
  const grouped: Record<string, Row[]> = { operating: [], investing: [], financing: [] };
  all.forEach((r) => grouped[r.section]?.push({ ...r, amount: Number(r.amount) }));

  const totals = sections.reduce(
    (acc, s) => ({ ...acc, [s]: grouped[s].reduce((a, r) => a + r.amount, 0) }),
    {} as Record<string, number>
  );
  const netChange = totals.operating + totals.investing + totals.financing;

  const labels: Record<string, string> = {
    operating: "Cash from Operating Activities",
    investing: "Cash from Investing Activities",
    financing: "Cash from Financing Activities",
  };
  const tones: Record<string, "navy" | "gold" | "purple"> = {
    operating: "navy",
    investing: "gold",
    financing: "purple",
  };

  const periodLabel = (periods ?? []).find((p) => p.id === periodId)?.period_label ?? "";

  return (
    <>
      <PageHeader
        title="Cash Flow Statement"
        subtitle={`${periodLabel} · Indirect method, simplified for MIS`}
        right={<PeriodSelector periods={periods ?? []} active={periodId} basePath="/cash-flow" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        {sections.map((s) => (
          <SummaryTile
            key={s}
            label={labels[s]!}
            value={formatINRUnit(totals[s])}
            tone={totals[s] >= 0 ? "green" : "red"}
            sub={`${grouped[s].length} accounts`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Card key={s}>
            <CardHeader
              title={labels[s]!}
              tag={{
                label: formatINRUnit(totals[s]),
                tone: totals[s] >= 0 ? "green" : "red",
              }}
            />
            <CardBody className="p-0">
              {grouped[s].length === 0 ? (
                <div className="px-5 py-6 text-sm text-ink-subtle">No movements.</div>
              ) : (
                <table className="fm-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th className="r">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[s].map((r) => (
                      <tr key={`${s}-${r.account_code}`}>
                        <td className="font-mono text-[11px] text-ink-subtle">{r.account_code}</td>
                        <td>{r.account_name}</td>
                        <td className={`r font-semibold ${r.amount < 0 ? "text-edred" : "text-edgreen"}`}>
                          {r.amount < 0 ? "(" : ""}
                          {formatINRUnit(Math.abs(r.amount))}
                          {r.amount < 0 ? ")" : ""}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-navy-50/40 font-bold">
                      <td colSpan={2} className="text-right text-[11px] uppercase text-navy">
                        Subtotal
                      </td>
                      <td className="r font-mono text-navy">{formatINRUnit(totals[s])}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardBody>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider font-bold text-ink-subtle">
              Net Change in Cash
            </span>
            <span
              className={`font-mono font-bold text-[18px] ${
                netChange >= 0 ? "text-edgreen" : "text-edred"
              }`}
            >
              {netChange >= 0 ? "+" : "−"}
              {formatINRUnit(Math.abs(netChange))}
            </span>
            <span
              className={`pill ${netChange >= 0 ? "pill-green" : "pill-red"}`}
            >
              {netChange >= 0 ? "Net Inflow" : "Net Outflow"}
            </span>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: "navy" | "red" | "green";
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden">
      <div className={`kpi-accent ${tone}`} />
      <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-ink-subtle">{label}</div>
      <div
        className={`mt-2 font-mono text-[22px] font-semibold leading-none ${
          tone === "green" ? "text-edgreen" : tone === "red" ? "text-edred" : "text-navy"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[10.5px] text-ink-subtle">{sub}</div>}
    </div>
  );
}
