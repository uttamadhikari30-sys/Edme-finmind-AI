import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import BoardReportsClient from "@/components/reports/board-reports-client";

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
      <BoardReportsClient orgId={membership.org_id} reports={(reports as any[]) ?? []} />

      <Card className="mt-4">
        <CardHeader title="Report History" tag={{ label: `${reports?.length ?? 0} reports`, tone: "navy" }} />
        <CardBody className="p-0">
          {!reports?.length ? (
            <EmptyState
              icon="📑"
              title="No reports generated yet"
              body="Click any tile above to generate a real branded board pack with your live numbers."
            />
          ) : (
            <table className="fm-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Generated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.title}</td>
                    <td><span className="pill pill-navy">{r.format.toUpperCase()}</span></td>
                    <td><span className={`pill ${r.status === "ready" ? "pill-green" : "pill-gold"}`}>{r.status}</span></td>
                    <td className="text-ink-muted">{new Date(r.generated_at).toLocaleString()}</td>
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
