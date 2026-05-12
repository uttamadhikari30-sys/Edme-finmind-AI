import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import LedgerUploadClient from "@/components/ledger/ledger-upload-client";

export const dynamic = "force-dynamic";

export default async function LedgerUploadPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  const [{ data: accounts }, { data: periods }, { data: history }, { data: bus }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("id, account_code, account_name, account_type")
      .eq("org_id", orgId)
      .order("account_code"),
    supabase
      .from("fiscal_periods")
      .select("id, period_label, start_date, end_date, status")
      .eq("org_id", orgId)
      .order("start_date"),
    supabase
      .from("ledger_uploads")
      .select("id, filename, data_type, row_count, status, uploaded_at")
      .eq("org_id", orgId)
      .order("uploaded_at", { ascending: false })
      .limit(20),
    supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .order("code"),
  ]);

  return (
    <>
      <PageHeader
        title="Ledger Upload — Step 1 of MIS"
        subtitle="Upload from Infor SunSystem or Revenue system. Once mapped, P&L · Dashboard · Cash Flow · Vertical Performance · MoM and all reports update with Actuals automatically."
      />
      <LedgerUploadClient
        orgId={orgId}
        accounts={accounts ?? []}
        periods={periods ?? []}
        history={history ?? []}
        bus={bus ?? []}
      />
    </>
  );
}
