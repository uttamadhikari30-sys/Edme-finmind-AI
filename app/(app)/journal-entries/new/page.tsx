import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import JournalEntryForm from "@/components/journal/journal-entry-form";
import PageHeader from "@/components/ui/page-header";

export default async function NewJournalEntryPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single();
  if (!membership) return null;

  const orgId = membership.org_id;

  const [{ data: accounts }, { data: periods }, { data: bus }] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("id, account_code, account_name, account_type")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("account_code"),
    supabase
      .from("fiscal_periods")
      .select("id, period_label, start_date, end_date, status")
      .eq("org_id", orgId)
      .order("start_date"),
    supabase
      .from("business_units")
      .select("id, code, name")
      .eq("org_id", orgId)
      .order("code"),
  ]);

  return (
    <>
      <PageHeader
        title="New Journal Entry"
        subtitle="Debits and credits must balance before the entry can be posted."
      />
      <JournalEntryForm
        orgId={orgId}
        accounts={accounts ?? []}
        periods={periods ?? []}
        businessUnits={bus ?? []}
      />
    </>
  );
}
