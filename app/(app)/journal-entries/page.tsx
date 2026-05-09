import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";

export default async function JournalEntriesPage() {
  await requireUser();
  const supabase = createClient();

  const { data: entries } = await supabase
    .from("journal_entries")
    .select(`
      id, entry_number, entry_date, description, status, posted_at,
      fiscal_periods(period_label),
      business_units(code, name),
      journal_entry_lines(debit_amount)
    `)
    .order("entry_date", { ascending: false })
    .order("entry_number", { ascending: false })
    .limit(100);

  const rows = (entries ?? []).map((e: any) => ({
    id: e.id,
    entry_number: e.entry_number,
    entry_date: e.entry_date,
    description: e.description,
    status: e.status,
    period_label: e.fiscal_periods?.period_label ?? "—",
    bu: e.business_units?.code ?? "—",
    total: (e.journal_entry_lines as { debit_amount: number }[]).reduce(
      (a, l) => a + Number(l.debit_amount),
      0
    ),
  }));

  return (
    <>
      <PageHeader
        title="Journal Entries"
        subtitle="Create, post, and review all general ledger transactions."
        right={
          <Link
            href="/journal-entries/new"
            className="px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-800 transition shadow-soft"
          >
            + New Entry
          </Link>
        }
      />

      <Card>
        <CardHeader title="All entries" tag={{ label: `${rows.length} entries`, tone: "navy" }} />
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No journal entries yet"
              body="Create your first entry to start tracking financial activity."
              cta={{ label: "New Entry", href: "/journal-entries/new" }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="fm-table">
                <thead>
                  <tr>
                    <th>Entry #</th>
                    <th>Date</th>
                    <th>Period</th>
                    <th>BU</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th className="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/journal-entries/${r.id}`} className="text-navy font-semibold hover:underline">
                          {r.entry_number}
                        </Link>
                      </td>
                      <td className="text-ink-muted">{r.entry_date}</td>
                      <td className="text-ink-muted">{r.period_label}</td>
                      <td><span className="pill pill-navy">{r.bu}</span></td>
                      <td className="max-w-[300px] truncate">{r.description}</td>
                      <td>
                        <span
                          className={`pill ${
                            r.status === "posted" ? "pill-green" : r.status === "draft" ? "pill-gold" : "pill-red"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="r">{formatINR(r.total, { compact: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
