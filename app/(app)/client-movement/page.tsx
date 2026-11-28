import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import AIInsightsCard from "@/components/ai/ai-insights-card";

export const dynamic = "force-dynamic";

const CUR = "FY 2026-27";
const PRIOR = "FY 2025-26";
const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

export default async function ClientMovementPage() {
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
  const role = (membership.role || "").toLowerCase();

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
    .select("id, name, business_unit_id, business_units(code, name)")
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

  type Agg = { cur: number; prior: number; curPrem: number; newProducts: Set<string>; allProducts: Set<string> };
  const byClient = new Map<string, Agg>();
  (policies ?? []).forEach((p: any) => {
    const a = byClient.get(p.client_id) ?? { cur: 0, prior: 0, curPrem: 0, newProducts: new Set(), allProducts: new Set() };
    if (p.fiscal_year === CUR) {
      a.cur += Number(p.brokerage_amt);
      a.curPrem += Number(p.premium);
      if (p.product_lines?.code) {
        a.allProducts.add(p.product_lines.code);
        if (p.basis === "new") a.newProducts.add(p.product_lines.code);
      }
    } else if (p.fiscal_year === PRIOR) {
      a.prior += Number(p.brokerage_amt);
    }
    byClient.set(p.client_id, a);
  });

  type Row = { id: string; name: string; bu: string; products: string; cur: number; prior: number; curPrem: number };
  const added: Row[] = [];
  const lost: Row[] = [];
  (clients ?? []).forEach((c: any) => {
    const a = byClient.get(c.id) ?? { cur: 0, prior: 0, curPrem: 0, newProducts: new Set(), allProducts: new Set() };
    const bu = c.business_units ? `${c.business_units.code} · ${c.business_units.name}` : "—";
    if (a.cur > 0 && a.prior === 0) {
      added.push({ id: c.id, name: c.name, bu, products: [...a.allProducts].join(", ") || "—", cur: a.cur, prior: 0, curPrem: a.curPrem });
    } else if (a.cur === 0 && a.prior > 0) {
      lost.push({ id: c.id, name: c.name, bu, products: "—", cur: 0, prior: a.prior, curPrem: 0 });
    } else if (a.newProducts.size > 0) {
      // Existing client that added a NEW product line = new business within a retained client
      added.push({ id: c.id, name: c.name, bu, products: [...a.newProducts].join(", "), cur: a.cur, prior: a.prior, curPrem: a.curPrem });
    }
  });

  const addedBrok = added.reduce((s, r) => s + r.cur, 0);
  const lostBrok = lost.reduce((s, r) => s + r.prior, 0);
  const net = addedBrok - lostBrok;

  return (
    <>
      <PageHeader
        title="Client Movement"
        subtitle={
          scopeBuId
            ? "Your new client wins / cross-sell and lapsed clients this year"
            : "New additions and lost clients across all verticals"
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="New / Added" value={`${added.length}`} sub={L(addedBrok)} tone="green" />
        <Stat label="Lost / Lapsed" value={`${lost.length}`} sub={L(lostBrok)} tone="red" />
        <Stat label="Net Clients" value={`${added.length - lost.length >= 0 ? "+" : ""}${added.length - lost.length}`} tone="navy" />
        <Stat label="Net Brokerage" value={`${net >= 0 ? "+" : ""}${L(net)}`} tone={net >= 0 ? "green" : "red"} />
      </div>

      <Card className="mb-4">
        <CardHeader title="New Additions & Cross-sell" tag={{ label: `${added.length} clients · ${L(addedBrok)}`, tone: "green" }} />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Client</th>
                {!scopeBuId && <th>Business Head</th>}
                <th>New Product(s)</th>
                <th className="r">Premium</th>
                <th className="r">Brokerage (FY27)</th>
              </tr>
            </thead>
            <tbody>
              {added.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.name}</td>
                  {!scopeBuId && <td className="text-ink-muted text-[11.5px]">{r.bu}</td>}
                  <td className="text-[11.5px] text-ink-muted">{r.products}</td>
                  <td className="r">{r.curPrem > 0 ? L(r.curPrem) : "—"}</td>
                  <td className="r font-semibold text-edgreen">{L(r.cur)}</td>
                </tr>
              ))}
              {added.length === 0 && <tr><td colSpan={scopeBuId ? 4 : 5} className="text-center text-ink-subtle py-6">No new additions yet.</td></tr>}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lost / Lapsed Clients" tag={{ label: `${lost.length} clients · ${L(lostBrok)}`, tone: "red" }} />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Client</th>
                {!scopeBuId && <th>Business Head</th>}
                <th className="r">Brokerage (FY26)</th>
                <th className="r">Brokerage (FY27)</th>
              </tr>
            </thead>
            <tbody>
              {lost.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.name}</td>
                  {!scopeBuId && <td className="text-ink-muted text-[11.5px]">{r.bu}</td>}
                  <td className="r text-ink-subtle">{L(r.prior)}</td>
                  <td className="r font-semibold text-edred">₹0.00 L</td>
                </tr>
              ))}
              {lost.length === 0 && <tr><td colSpan={scopeBuId ? 3 : 4} className="text-center text-ink-subtle py-6">No lost clients — nice.</td></tr>}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="mt-4">
        <AIInsightsCard
          page="client-movement"
          density="wide"
          title="🤖 FINMIND Advisor"
          context={{
            org: "Edme Insurance Brokers Limited",
            scope: scopeBuId ? "single vertical" : "company-wide",
            new_clients: added.length,
            lost_clients: lost.length,
            new_brokerage_lakh: +(addedBrok / 1e5).toFixed(1),
            lost_brokerage_lakh: +(lostBrok / 1e5).toFixed(1),
            net_brokerage_lakh: +(net / 1e5).toFixed(1),
          }}
        />
      </div>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "navy" | "green" | "gold" | "red" }) {
  const color = { navy: "text-navy", green: "text-edgreen", gold: "text-gold", red: "text-edred" }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[22px] font-bold mt-0.5 ${color}`}>{value}</div>
        {sub && <div className="text-[11px] text-ink-muted font-mono mt-0.5">{sub}</div>}
      </CardBody>
    </Card>
  );
}
