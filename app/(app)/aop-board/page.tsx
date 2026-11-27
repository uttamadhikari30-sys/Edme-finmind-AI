import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import FreezeControl from "@/components/aop/freeze-control";

export const dynamic = "force-dynamic";

const PLAN_FY = "FY 2027-28";
const BASIS_FY = "FY 2026-27";
const CONV_THRESHOLD = 60;
const L = (v: number) => `₹${(v / 1e5).toFixed(2)} L`;

export default async function AopBoardPage() {
  await requireUser();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!member) return null;
  const role = (member.role || "").toLowerCase();
  if (role === "bh") redirect("/dashboard");
  const orgId = member.org_id;
  const isBoard = ["owner", "cfo", "ceo"].includes(role);

  const { data: bus } = await supabase
    .from("business_units")
    .select("id, code, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("code");

  const { data: plan } = await supabase
    .from("aop_plan_lines")
    .select("business_unit_id, planned_premium, brokerage_pct, conversion_pct, basis")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY);

  const { data: costs } = await supabase
    .from("aop_cost_lines")
    .select("business_unit_id, category, amount")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY);

  const { data: basisPol } = await supabase
    .from("policies")
    .select("business_unit_id, brokerage_amt")
    .eq("org_id", orgId)
    .eq("fiscal_year", BASIS_FY);

  const { data: ver } = await supabase
    .from("aop_versions")
    .select("status")
    .eq("org_id", orgId)
    .eq("fiscal_year", PLAN_FY)
    .maybeSingle();
  const status = (((ver as any)?.status as string) || "draft") as "draft" | "frozen" | "approved";

  const brok = new Map<string, number>();
  (plan ?? []).forEach((p: any) => {
    const counts = p.basis === "renewal" || Number(p.conversion_pct) >= CONV_THRESHOLD;
    if (!counts) return;
    brok.set(p.business_unit_id, (brok.get(p.business_unit_id) ?? 0) + (Number(p.planned_premium) * Number(p.brokerage_pct)) / 100);
  });
  // BH cost = hiring + direct; overhead = mid-office + back-office (Finance)
  const people = new Map<string, number>();
  const direct = new Map<string, number>();
  (costs ?? []).forEach((c: any) => {
    const isOverhead = c.category === "mid_office" || c.category === "back_office";
    const m = isOverhead ? direct : people;
    m.set(c.business_unit_id, (m.get(c.business_unit_id) ?? 0) + (Number(c.amount) || 0));
  });
  const basis = new Map<string, number>();
  (basisPol ?? []).forEach((p: any) => {
    basis.set(p.business_unit_id, (basis.get(p.business_unit_id) ?? 0) + (Number(p.brokerage_amt) || 0));
  });

  const rows = (bus ?? []).map((b: any) => {
    const cb = brok.get(b.id) ?? 0;
    const pc = people.get(b.id) ?? 0;
    const dc = direct.get(b.id) ?? 0;
    const profit = cb - pc - dc;
    const ly = basis.get(b.id) ?? 0;
    const growth = ly > 0 ? ((cb - ly) / ly) * 100 : 0;
    return { id: b.id, name: `${b.code} · ${b.name}`, cb, pc, dc, profit, growth, margin: cb > 0 ? (profit / cb) * 100 : 0 };
  });

  const tot = rows.reduce(
    (t, r) => ({ cb: t.cb + r.cb, pc: t.pc + r.pc, dc: t.dc + r.dc, profit: t.profit + r.profit }),
    { cb: 0, pc: 0, dc: 0, profit: 0 }
  );
  const totMargin = tot.cb > 0 ? (tot.profit / tot.cb) * 100 : 0;

  return (
    <>
      <PageHeader title="AOP Board" subtitle={`${PLAN_FY} · company-wide annual operating plan — freeze and board sign-off`} />

      <Card className="mb-4">
        <CardBody className="py-4">
          {isBoard ? (
            <FreezeControl fiscalYear={PLAN_FY} status={status} />
          ) : (
            <div className="text-[12.5px] text-ink-muted">
              Status: <span className="font-bold text-navy uppercase">{status}</span> — only the CFO / CEO can freeze or approve.
            </div>
          )}
          {status !== "draft" && (
            <p className="text-[11px] text-ink-muted mt-2">
              The AOP is locked — Business Head and Finance entry is disabled until it is reopened.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Committed Brokerage" value={L(tot.cb)} tone="green" />
        <Stat label="Total Cost" value={L(tot.pc + tot.dc)} tone="red" />
        <Stat label="AOP Profit" value={L(tot.profit)} tone={tot.profit >= 0 ? "navy" : "red"} />
        <Stat label="Margin" value={`${totMargin.toFixed(1)}%`} tone={totMargin >= 0 ? "navy" : "red"} />
      </div>

      <Card>
        <CardHeader title="AOP by Vertical" tag={{ label: `${rows.length} verticals`, tone: "navy" }} />
        <CardBody className="p-0">
          <table className="fm-table">
            <thead>
              <tr>
                <th>Vertical</th>
                <th className="r">Committed Brokerage</th>
                <th className="r">BH Cost</th>
                <th className="r">Overhead</th>
                <th className="r">AOP Profit</th>
                <th className="r">Margin</th>
                <th className="r">Growth vs {BASIS_FY}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.name}</td>
                  <td className="r font-semibold text-edgreen">{L(r.cb)}</td>
                  <td className="r text-ink-subtle">{L(r.pc)}</td>
                  <td className="r text-ink-subtle">{L(r.dc)}</td>
                  <td className={`r font-semibold ${r.profit >= 0 ? "text-navy" : "text-edred"}`}>{L(r.profit)}</td>
                  <td className="r">{r.margin.toFixed(1)}%</td>
                  <td className={`r font-semibold ${r.growth >= 0 ? "text-edgreen" : "text-edred"}`}>
                    {r.growth >= 0 ? "+" : ""}{r.growth.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-ink-subtle py-6">No AOP data yet.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="font-bold border-t-2 border-[var(--border)]">
                  <td>Company Total</td>
                  <td className="r text-edgreen">{L(tot.cb)}</td>
                  <td className="r">{L(tot.pc)}</td>
                  <td className="r">{L(tot.dc)}</td>
                  <td className={`r ${tot.profit >= 0 ? "text-navy" : "text-edred"}`}>{L(tot.profit)}</td>
                  <td className="r">{totMargin.toFixed(1)}%</td>
                  <td className="r"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardBody>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "navy" | "green" | "gold" | "red" }) {
  const color = { navy: "text-navy", green: "text-edgreen", gold: "text-gold", red: "text-edred" }[tone];
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-subtle">{label}</div>
        <div className={`font-mono text-[22px] font-bold mt-0.5 ${color}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
