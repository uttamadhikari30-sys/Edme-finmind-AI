import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InsuranceMarketPage() {
  // Static intelligence cards — wire to real news/data feed in v1.1
  const headlines = [
    {
      h: "Motor insurance premiums up 8% YoY",
      d: "Third-party liability revision · renewal season opportunity for Edme",
      tag: "Market",
      tone: "gold" as const,
    },
    {
      h: "Health insurance gross written premium grows 21%",
      d: "GMC + retail health drove most growth · Edme retail health is positioned to scale",
      tag: "Growth",
      tone: "green" as const,
    },
    {
      h: "Corporate renewals peak: Nov–Jan window",
      d: "42% of Edme book renews Nov–Jan · pipeline focus and LE accuracy key",
      tag: "Pipeline",
      tone: "green" as const,
    },
    {
      h: "Cyber & D&O liability hardening",
      d: "Premium uplift 15–25% in mid-cap · margin opportunity if delivered well",
      tag: "Pricing",
      tone: "navy" as const,
    },
    {
      h: "IRDAI norms on broker disclosures (Q1 FY27)",
      d: "Operational impact: documentation update · review compliance team capacity",
      tag: "Regulatory",
      tone: "red" as const,
    },
    {
      h: "Group medical loss ratios stabilising",
      d: "Industry LR at 91% from 96% · negotiation leverage improving",
      tag: "Reinsurance",
      tone: "navy" as const,
    },
  ];

  const positions = [
    { l: "Corporate",   edme: 85, mkt: 72 },
    { l: "SME & MSME",  edme: 72, mkt: 61 },
    { l: "Health",      edme: 68, mkt: 58 },
    { l: "Retail/HNW",  edme: 45, mkt: 52 },
    { l: "Motor",       edme: 38, mkt: 49 },
  ];

  return (
    <>
      <PageHeader
        title="Insurance Market"
        subtitle="Industry intelligence · headlines · Edme market position vs benchmarks"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="📰 Headlines" tag={{ label: "Daily", tone: "navy" }} />
            <CardBody>
              <div className="space-y-3">
                {headlines.map((n, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--border)] p-3 hover:bg-bg-alt transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`pill pill-${n.tone} flex-shrink-0`}>{n.tag}</span>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-navy leading-snug">{n.h}</div>
                        <div className="text-[11.5px] text-ink-muted mt-1 leading-relaxed">{n.d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="🏛 Edme Market Position" tag={{ label: "Score / 100", tone: "purple" }} />
          <CardBody>
            <div className="space-y-3">
              {positions.map((p) => {
                const good = p.edme >= p.mkt;
                return (
                  <div key={p.l}>
                    <div className="flex items-center mb-1">
                      <span className="text-[12px] font-semibold text-navy">{p.l}</span>
                      <span
                        className={`ml-auto text-[10.5px] font-bold ${
                          good ? "text-edgreen" : "text-gold"
                        }`}
                      >
                        Edme {p.edme}% vs Mkt {p.mkt}%
                      </span>
                    </div>
                    <div className="h-2 bg-bg-alt rounded relative overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded ${
                          good
                            ? "bg-gradient-to-r from-edgreen to-emerald-400"
                            : "bg-gradient-to-r from-gold to-amber-400"
                        }`}
                        style={{ width: `${p.edme}%` }}
                      />
                      <div
                        className="absolute inset-y-0 w-px bg-edred"
                        style={{ left: `${p.mkt}%` }}
                        title={`Market ${p.mkt}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[10.5px] text-ink-subtle italic">
              Composite of: GWP share · client retention · new logo wins · pricing power · book quality.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="🎯 Edme Action Items" tag={{ label: "AI Priorities", tone: "purple" }} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ActionCard
              tone="green"
              title="Capture Q3 renewals window"
              body="42% of corporate book renews Nov–Jan — push BH teams for early outreach."
            />
            <ActionCard
              tone="gold"
              title="Build retail/HNW capacity"
              body="Edme is below market in retail/HNW (45% vs 52%) — consider talent investment."
            />
            <ActionCard
              tone="red"
              title="Compliance prep for IRDAI Q1"
              body="Set up working group with legal + compliance to action upcoming disclosure norms."
            />
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function ActionCard({
  tone,
  title,
  body,
}: {
  tone: "green" | "red" | "gold";
  title: string;
  body: string;
}) {
  const cls = {
    green: "border-edgreen/25 bg-edgreen-50/40",
    red: "border-edred/25 bg-edred-50/40",
    gold: "border-gold/25 bg-gold-50/40",
  } as const;
  const titleColor = { green: "text-edgreen", red: "text-edred", gold: "text-gold" } as const;
  return (
    <div className={`rounded-xl border p-3 ${cls[tone]}`}>
      <div className={`text-[11.5px] font-bold uppercase tracking-wider ${titleColor[tone]}`}>{title}</div>
      <div className="text-[12px] text-ink-muted mt-1.5 leading-relaxed">{body}</div>
    </div>
  );
}
