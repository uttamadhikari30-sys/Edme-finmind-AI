import { redirect } from "next/navigation";

// MIS scope — Balance Sheet retired in favor of Cash Flow.
export default function BalanceSheetRedirect() {
  redirect("/cash-flow");
}
