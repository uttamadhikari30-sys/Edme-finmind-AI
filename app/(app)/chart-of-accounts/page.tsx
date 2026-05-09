import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";

const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

export default async function ChartOfAccountsPage() {
  await requireUser();
  const supabase = createClient();
  const { data: accounts } = await supabase
    .from("chart_of_accounts")
    .select("id, account_code, account_name, account_type, is_active")
    .order("account_code");

  const grouped: Record<string, typeof accounts> = {};
  (accounts ?? []).forEach((a) => {
    grouped[a.account_type] = grouped[a.account_type] ?? [];
    grouped[a.account_type]!.push(a);
  });

  return (
    <>
      <PageHeader
        title="Chart of Accounts"
        subtitle="The list of all accounts available for journal entries."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TYPE_ORDER.map((type) => (
          <Card key={type}>
            <CardHeader
              title={TYPE_LABELS[type]!}
              tag={{ label: `${grouped[type]?.length ?? 0} accounts`, tone: "navy" }}
            />
            <CardBody className="p-0">
              {!grouped[type]?.length ? (
                <div className="px-5 py-6 text-sm text-ink-subtle">No accounts.</div>
              ) : (
                <table className="fm-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[type]!.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono text-[11px] text-ink-subtle">{a.account_code}</td>
                        <td>{a.account_name}</td>
                        <td>
                          <span className={`pill ${a.is_active ? "pill-green" : "pill-red"}`}>
                            {a.is_active ? "active" : "inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
