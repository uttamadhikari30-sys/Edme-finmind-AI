import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import FinancialsClient from "@/components/aop/financials-client";
import { loadAopFinancials } from "@/lib/aop-financials-data";

export const dynamic = "force-dynamic";

export default async function AOPCFSPage() {
  await requireUser();
  const d = await loadAopFinancials();
  if (!d) return null;
  if (d.isBH) redirect("/dashboard");
  return (
    <>
      <PageHeader
        title="AOP Cash Flow"
        subtitle={`${d.planFy} · auto-generated from the AOP + opening balances, phased month-on-month`}
      />
      <FinancialsClient
        fiscalYear={d.planFy}
        aop={d.aop}
        initialOpening={d.opening}
        weights={d.weights}
        canEdit={d.canEdit}
        view="cfs"
      />
    </>
  );
}
