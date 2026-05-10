import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AopStatementTable from "@/components/aop/aop-statement-table";

export const dynamic = "force-dynamic";

const SECTION_LABELS = {
  OPERATING: "(A) Cash flow from operating activities",
  INVESTING: "(B) Cash flow from investing activities",
  FINANCING: "(C) Cash flow from financing activities",
  NET_CHANGE: "Net increase / (decrease) in cash",
  CASH: "Cash & cash equivalents",
};

export default async function AOPCFSPage() {
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
    .eq("statement", "cfs")
    .order("sort_order");

  return (
    <>
      <PageHeader
        title="AOP — Cash Flow Statement"
        subtitle="Edme – AOP Cash Flow FY 2026-27 · Indirect method, monthly"
      />
      <AopStatementTable
        title="💵 AOP Cash Flow Statement"
        fyLabel="FY 2026-27"
        rows={(rows as any[]) ?? []}
        sectionLabels={SECTION_LABELS}
      />
    </>
  );
}
