import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import PostButton from "@/components/journal/post-button";
import { formatINR } from "@/lib/utils";

export default async function JEDetail({ params }: { params: { id: string } }) {
  await requireUser();
  const supabase = createClient();

  const { data: je } = await supabase
    .from("journal_entries")
    .select(`
      id, entry_number, entry_date, description, status, posted_at,
      fiscal_periods(period_label),
      business_units(code, name),
      journal_entry_lines(
        line_number, description, debit_amount, credit_amount,
        chart_of_accounts(account_code, account_name, account_type),
        business_units(code)
      )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (!je) return notFound();

  const lines = (je.journal_entry_lines as any[]).slice().sort((a, b) => a.line_number - b.line_number);
  const totalDr = lines.reduce((a, l) => a + Number(l.debit_amount), 0);
  const totalCr = lines.reduce((a, l) => a + Number(l.credit_amount), 0);

  return (
    <>
      <PageHeader
        title={`Entry ${je.entry_number}`}
        subtitle={`${je.entry_date} · ${(je.fiscal_periods as any)?.period_label ?? "—"}`}
        right={
          <Link href="/journal-entries" className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-bg-alt text-ink-muted text-xs font-semibold hover:text-navy hover:border-navy">
            ← Back
          </Link>
        }
      />

      <Card>
        <CardHeader
          title="Detail"
          tag={{
            label: je.status,
            tone: je.status === "posted" ? "green" : je.status === "draft" ? "gold" : "red",
          }}
          right={je.status === "draft" ? <PostButton id={je.id} /> : null}
        />
        <CardBody>
          {je.description && <p className="text-sm text-ink-muted mb-4">{je.description}</p>}
          <div className="overflow-x-auto">
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th>BU</th>
                  <th className="r">Debit</th>
                  <th className="r">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => (
                  <tr key={l.line_number}>
                    <td className="text-ink-subtle">{l.line_number}</td>
                    <td>
                      <span className="font-mono text-[11px] text-ink-subtle mr-2">
                        {(l.chart_of_accounts as any)?.account_code}
                      </span>
                      {(l.chart_of_accounts as any)?.account_name}
                    </td>
                    <td className="text-ink-muted">{l.description ?? "—"}</td>
                    <td><span className="pill pill-navy">{(l.business_units as any)?.code ?? "—"}</span></td>
                    <td className="r">{Number(l.debit_amount) ? formatINR(Number(l.debit_amount), { compact: true }) : ""}</td>
                    <td className="r">{Number(l.credit_amount) ? formatINR(Number(l.credit_amount), { compact: true }) : ""}</td>
                  </tr>
                ))}
                <tr className="bg-navy-50/40 font-bold">
                  <td colSpan={4} className="text-right text-[11px] uppercase tracking-wider text-navy">Totals</td>
                  <td className="r font-mono text-navy">{formatINR(totalDr, { compact: true })}</td>
                  <td className="r font-mono text-navy">{formatINR(totalCr, { compact: true })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
