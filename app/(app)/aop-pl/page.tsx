import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import AopStatementTable from "@/components/aop/aop-statement-table";

export const dynamic = "force-dynamic";

const SECTION_LABELS = {
  REVENUE: "Revenue",
  EXPENSES: "Expenses",
  EBITDA: "Earnings Before Interest, Tax, Depreciation & Amortisation",
  OTHER: "Other Income / Charges",
  PBT: "Profit / (Loss) Before Tax",
  TAX: "Income Tax Expenses",
  PAT: "Profit / (Loss) After Tax",
};

export default async function AOPPLPage() {
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
    .eq("statement", "pl")
    .order("sort_order");

  return (
    <>
      <PageHeader
        title="AOP — Profit & Loss"
        subtitle="Edme – AOP Profit & Loss FY 2026-27 · Bottom-up budget consolidation"
      />
      <AopStatementTable
        title="📋 AOP P&L Statement"
        fyLabel="FY 2026-27"
        rows={(rows as any[]) ?? []}
        sectionLabels={SECTION_LABELS}
      />
    </>
  );
}
