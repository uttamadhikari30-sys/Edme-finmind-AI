import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function BoardReportsPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;

  const { data: reports } = await supabase
    .from("board_reports")
    .select("id, title, format, status, generated_at")
    .eq("org_id", membership.org_id)
    .order("generated_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader
        title="Board Reports"
        subtitle="Auto-generated PPT, PDF and Excel MIS — board-ready, branded, and downloadable."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <ReportTile
          title="Board PPT"
          icon="📊"
          desc="20-slide CFO-ready deck: KPIs, P&L, variance, vertical performance, narrative."
          format="PPTX"
          tone="navy"
        />
        <ReportTile
          title="MIS PDF"
          icon="📄"
          desc="Print-ready monthly MIS book: P&L, cash flow, top variances, vertical dashboards."
          format="PDF"
          tone="red"
        />
        <ReportTile
          title="MIS Excel"
          icon="📗"
          desc="Source data export: monthly P&L, ledger, budget vs actual, all in one workbook."
          format="XLSX"
          tone="green"
        />
      </div>

      <Card>
        <CardHeader title="Report History" tag={{ label: `${reports?.length ?? 0} reports`, tone: "navy" }} />
        <CardBody className="p-0">
          {!reports?.length ? (
            <EmptyState
              icon="📑"
              title="No reports generated yet"
              body="Click any report tile above to queue a generation. The first PPT/PDF/XLSX templates will be wired in the next sprint."
            />
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.title}</td>
                    <td>
                      <span className="pill pill-navy">{r.format}</span>
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          r.status === "ready" ? "pill-green" : r.status === "failed" ? "pill-red" : "pill-gold"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="text-ink-muted">{new Date(r.generated_at).toLocaleString()}</td>
                    <td>
                      <button className="text-[11px] text-navy font-semibold hover:underline">Download</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function ReportTile({
  title,
  icon,
  desc,
  format,
  tone,
}: {
  title: string;
  icon: string;
  desc: string;
  format: string;
  tone: "navy" | "red" | "green";
}) {
  return (
    <div className="bg-white rounded-[14px] p-5 border border-[var(--border)] shadow-soft relative overflow-hidden hover:shadow-card transition-all">
      <div className={`kpi-accent ${tone}`} />
      <div className="text-[36px] mb-2">{icon}</div>
      <div className="font-serif text-[16px] font-bold text-navy">{title}</div>
      <div className="text-[11.5px] text-ink-muted mt-1.5 leading-relaxed">{desc}</div>
      <div className="mt-4 flex items-center gap-2">
        <button
          className={`px-3.5 py-1.5 rounded-lg text-white text-[11.5px] font-semibold shadow-soft ${
            tone === "navy"
              ? "bg-navy hover:bg-navy-800"
              : tone === "red"
              ? "bg-edred hover:bg-edred-600"
              : "bg-edgreen hover:brightness-110"
          }`}
        >
          ⚡ Generate {format}
        </button>
        <span className="text-[10.5px] text-ink-subtle">~ 30 sec</span>
      </div>
    </div>
  );
}
