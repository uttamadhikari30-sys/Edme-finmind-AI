import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const CUR = "FY 2026-27";
const PRIOR = "FY 2025-26";
const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

export default async function ClientsPage() {
  await requireUser();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!membership) return null;
  const orgId = membership.org_id;
  const role = membership.role;

  let scopeBuId: string | null = null;
  if (role === "bh" && user) {
    const { data: myBu } = await supabase
      .from("business_units")
      .select("id")
      .eq("org_id", orgId)
      .eq("manager_user_id", user.id)
      .maybeSingle();
    scopeBuId = (myBu as any)?.id ?? null;
  }

  let clientsQ = supabase
    .from("clients")
    .select("id, name, status, business_unit_id, business_units(code, name)")
    .eq("org_id", orgId)
    .order("name");
  if (scopeBuId) clientsQ = clientsQ.eq("business_unit_id", scopeBuId);
  const { data: clients } = await clientsQ;

  let polQ = supabase
    .from("policies")
    .select("client_id, fiscal_year, basis, brokerage_amt, premium, product_lines(code)")
    .eq("org_id", orgId);
  if (scopeBuId) polQ = polQ.eq("business_unit_id", scopeBuId);
  const { data: policies } = await polQ;

  // Aggregate per client
  type Agg = { cur: number; prior: number; curPrem: number; products: Set<string>; hasNew: boolean };
  const byClient = new Map<string, Agg>();
  (policies ?? []).forEach((p: any) => {
    const a = byClient.get(p.client_id) ?? { cur: 0, prior: 0, curPrem: 0, products: new Set(), hasNew: false };
    if (p.fiscal_year === CUR) {
      a.cur += Number(p.brokerage_amt);
      a.curPrem += Number(p.premium);
      if (p.product_lines?.code) a.products.add(p.product_lines.code);
      if (p.basis === "new") a.hasNew = true;
    } else if (p.fiscal_year === PRIOR) {
      a.prior += Number(p.brokerage_amt);
    }
    byClient.set(p.client_id, a);
  });

  const rows = (clients ?? []).map((c: any) => {
    const a = byClient.get(c.id) ?? { cur: 0, prior: 0, curPrem: 0, products: new Set(), hasNew: false };
    let state: "new" | "lost" | "renewal" | "upsell";
    if (a.cur > 0 && a.prior === 0) state = "new";
    else if (a.cur === 0 && a.prior > 0) state = "lost";
    else if (a.hasNew) state = "upsell";
    else state = "renewal";
    return {
      id: c.id,
      name: c.name,
      bu: c.business_units ? `${c.business_units.code} · ${c.business_units.name}` : "—",
      products: [...a.products].join(", ") || "—",
      curPrem: a.curPrem,
      cur: a.cur,
      prior: a.prior,
      state,
    };
  });

  const nNew = rows.filter((r) => r.state === "new").length;
  const nLost = rows.filter((r) => r.state === "lost").length;
  const nUpsell = rows.filter((r) => r.state === "upsell").length;
  const totalBrok = rows.reduce((s, r) => s + r.cur, 0);

  const STATE = {
    new: { label: "New", cls: "pill-green" },
    lost: { label: "Lost", cls: "pill-red" },
    upsell: { label: "Cross-sell", cls: "pill-gold" },
    renewal: { label: "Renewal", cls: "pill-navy" },
  } as const;

  return (
    <>
      <PageHeader
        title="Customer List"
        subtitle={
          scopeBuId
            ? "Your clients — renewals, new business, cross-sell and lapsed"
            : "All clients across verticals, tagged by Business Head"
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Clients" value={`${rows.length}`} tone="navy" />
        <Stat label="New this FY" value={`${nNew}`} tone="green" />
        <Stat label="Cross-sell" value={`${nUpsell}`} tone="gold" />
        <Stat label="Lost / lapsed" value={`${nLost}`} tone="red" />
      </div>

      <Card>
        <CardHeader
          title="Clients"
          tag={{ label: `${L(totalBrok)} brokerage`, tone: "green" }}
        />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Client</th>
                {!scopeBuId && <th>Business Head</th>}
                <th>Products</th>
                <th className="r">Premium (FY27)</th>
                <th className="r">Brokerage (FY27)</th>
                <th className="r">Brokerage (FY26)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.name}</td>
                  {!scopeBuId && <td className="text-ink-muted text-[11.5px]">{r.bu}</td>}
                  <td className="text-[11.5px] text-ink-muted">{r.products}</td>
                  <td className="r">{r.curPrem > 0 ? L(r.curPrem) : "—"}</td>
                  <td className="r font-semibold">{r.cur > 0 ? L(r.cur) : "—"}</td>
                  <td className="r text-ink-subtle">{r.prior > 0 ? L(r.prior) : "—"}</td>
                  <td>
                    <span className={`pill ${STATE[r.state].cls}`}>{STATE[r.state].label}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-ink-subtle py-6">
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "navy" | "green" | "gold" | "red" }) {
  const color = {
    navy: "text-navy",
    green: "text-edgreen",
    gold: "text-gold",
    red: "text-edred",
  }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[22px] font-bold mt-0.5 ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
