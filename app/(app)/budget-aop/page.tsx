import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Budget / AOP is consolidated into the AOP Builder (the client & product-level
// planning engine). This route redirects there so existing links keep working.
export default function BudgetAopPage() {
  redirect("/aop-builder");
}
