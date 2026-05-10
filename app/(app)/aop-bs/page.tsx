import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AopStatementTable from "@/components/aop/aop-statement-table";

export const dynamic = "force-dynamic";

const SECTION_LABELS = {
  NON_CURRENT_ASSETS: "Non-Current Assets",
  CURRENT_ASSETS: "Current Assets",
  TOTAL_ASSETS: "Total Assets",
  EQUITY: "Equity",
  NON_CURRENT_LIAB: "Non-Current Liabilities",
  CURRENT_LIAB: "Current Liabilities",
  TOTAL_LIAB_EQ: "Total Equity & Liabilities",
};

export default async function AOPBSPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id")
    .limit(1)
    .single()) as { data: { org_id: string } | null };
  if (!membership) return null;

  const { data: rows } = await supabase
    .from("aop_statements")
    .select("*")
    .eq("org_id", membership.org_id)
    .eq("statement", "bs")
    .order("sort_order");

  return (
    <>
      <PageHeader
        title="AOP — Balance Sheet"
        subtitle="Edme – AOP Balance Sheet FY 2026-27 · Monthly progression"
      />
      <AopStatementTable
        title="🏛 AOP Balance Sheet"
        fyLabel="FY 2026-27"
        rows={(rows as any[]) ?? []}
        sectionLabels={SECTION_LABELS}
      />
    </>
  );
}
