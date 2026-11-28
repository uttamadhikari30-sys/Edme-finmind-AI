import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import DebtorsPayablesClient, { type DP } from "@/components/finance/debtors-payables-client";
import AIInsightsCard from "@/components/ai/ai-insights-card";

export const dynamic = "force-dynamic";

export default async function DebtorsPayablesPage() {
  await requireUser();
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: member } = (await supabase
    .from("org_members").select("org_id, role").eq("user_id", user?.id ?? "").limit(1).single()) as
    { data: { org_id: string; role: string } | null };
  if (!member) return null;
  const role = (member.role || "").toLowerCase();
  if (role === "bh") redirect("/dashboard");
  const orgId = member.org_id;

  const { data } = await supabase
    .from("debtor_payable")
    .select("id, kind, party, team, invoice_no, invoice_date, due_date, amount, collected, status, notes")
    .eq("org_id", orgId)
    .order("due_date", { ascending: true });

  const items: DP[] = (data ?? []).map((r: any) => ({
    id: r.id, kind: r.kind, party: r.party, team: r.team,
    invoice_no: r.invoice_no, invoice_date: r.invoice_date, due_date: r.due_date,
    amount: Number(r.amount) || 0, collected: Number(r.collected) || 0, status: r.status, notes: r.notes,
  }));

  const today = Date.now();
  const bucketDays = (d: string | null) => (d ? Math.floor((today - new Date(d + "T00:00:00").getTime()) / 86400000) : -1);
  const debtors = items.filter((i) => i.kind === "debtor");
  const recv = debtors.reduce((s, i) => s + Math.max(i.amount - i.collected, 0), 0);
  const overdue90 = debtors.filter((i) => bucketDays(i.due_date) > 90).reduce((s, i) => s + Math.max(i.amount - i.collected, 0), 0);
  const pay = items.filter((i) => i.kind === "payable").reduce((s, i) => s + Math.max(i.amount - i.collected, 0), 0);

  const aiCtx = {
    org: "Edme Insurance Brokers Limited",
    receivables_outstanding_lakh: +(recv / 1e5).toFixed(1),
    receivables_90plus_lakh: +(overdue90 / 1e5).toFixed(1),
    payables_outstanding_lakh: +(pay / 1e5).toFixed(1),
    open_debtors: debtors.filter((i) => i.amount - i.collected > 0).length,
  };

  return (
    <>
      <PageHeader title="Debtors & Payables" subtitle="Receivables & payables tracking · auto collection report for Corporate & RI teams" />
      <DebtorsPayablesClient initial={items} />
      <div className="mt-4">
        <AIInsightsCard page="debtors-payables" density="wide" title="🤖 FINMIND Collection Advisor" context={aiCtx} />
      </div>
    </>
  );
}
