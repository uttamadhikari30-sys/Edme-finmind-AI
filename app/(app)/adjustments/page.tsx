import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AdjustmentsClient from "@/components/adjustments/adjustments-client";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;

  // Strict role gate — only Owner / CFO / Finance can view
  const allowedRoles = ["owner", "cfo", "finance"];
  if (!allowedRoles.includes(membership.role)) {
    return (
      <>
        <PageHeader title="Adjustment Sheet" subtitle="Restricted access" />
        <Card>
          <CardBody>
            <div className="rounded-xl bg-edred-50 border border-edred/30 px-4 py-4">
              <div className="text-[14px] font-bold text-edred mb-1">🔒 Restricted</div>
              <div className="text-[12.5px] text-ink-muted">
                The Adjustment Sheet is only accessible to Finance, CFO, and Owner roles. Contact your admin
                if you need access for legitimate adjustment entries.
              </div>
            </div>
          </CardBody>
        </Card>
      </>
    );
  }

  const [{ data: accounts }, { data: periods }, { data: bus }, { data: adjustments }] =
    await Promise.all([
      supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name, account_type")
        .eq("org_id", orgId)
        .order("account_code"),
      supabase
        .from("fiscal_periods")
        .select("id, period_label, status")
        .eq("org_id", orgId)
        .order("start_date"),
      supabase
        .from("business_units")
        .select("id, code, name")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("code"),
      supabase
        .from("adjustment_entries")
        .select(`
          id, period_id, account_id, business_unit_id, adjustment_type,
          description, reason, amount, is_increase, status, created_at,
          chart_of_accounts(account_code, account_name, account_type),
          fiscal_periods(period_label),
          business_units(code)
        `)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  return (
    <>
      <PageHeader
        title="Adjustment Sheet"
        subtitle="Revenue and Cost adjustments · Finance / CFO only · auto-applied to P&L, MIS and reports"
      />
      <AdjustmentsClient
        orgId={orgId}
        role={membership.role}
        accounts={(accounts as any[]) ?? []}
        periods={(periods as any[]) ?? []}
        bus={(bus as any[]) ?? []}
        adjustments={(adjustments as any[]) ?? []}
      />
    </>
  );
}
