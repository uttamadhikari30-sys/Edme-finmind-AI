import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = createClient();
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role, full_name, organizations(name, slug, currency, fiscal_year_start_month, created_at)")
    .limit(1)
    .single();

  const org = membership?.organizations as any;

  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace and account preferences." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Organization" />
          <CardBody>
            <Row label="Name" value={org?.name} />
            <Row label="Slug" value={org?.slug} />
            <Row label="Currency" value={org?.currency} />
            <Row label="Fiscal year starts" value={`Month ${org?.fiscal_year_start_month}`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Your account" />
          <CardBody>
            <Row label="Email" value={user.email ?? "—"} />
            <Row label="Display name" value={membership?.full_name ?? (user.user_metadata?.full_name as string) ?? "—"} />
            <Row label="Role" value={membership?.role ?? "—"} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Coming soon" tag={{ label: "Roadmap", tone: "purple" }} />
        <CardBody>
          <ul className="text-sm text-ink-muted space-y-2 list-disc list-inside">
            <li>Inviting teammates by email with role-based permissions (CFO, CEO, BH, Finance, Viewer).</li>
            <li>Closing fiscal periods to lock historical data.</li>
            <li>Excel/PDF export for P&L, Balance Sheet, and Variance.</li>
            <li>Maya AI assistant — natural-language query over your books.</li>
          </ul>
        </CardBody>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center py-2 border-b border-[var(--border-2)] last:border-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle w-1/3">{label}</div>
      <div className="text-sm text-ink">{value || "—"}</div>
    </div>
  );
}
