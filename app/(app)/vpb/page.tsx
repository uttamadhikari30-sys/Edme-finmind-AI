import PageHeader from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function VPBPage() {
  return (
    <>
      <PageHeader
        title="Variable Pay (VPB) Calculator"
        subtitle="Tier-based incentive engine · revenue achievement × multiplier × pool"
      />
      <Card>
        <CardHeader title="VPB Engine" tag={{ label: "Coming soon", tone: "purple" }} />
        <CardBody>
          <EmptyState
            icon="💜"
            title="VPB engine setup pending"
            body="The Variable Pay engine will compute payouts per business head based on AOP achievement tiers. Wiring this up requires AOP data and tier configuration — let your finance team finalize the tier slabs first, then we'll activate it here."
          />
        </CardBody>
      </Card>
    </>
  );
}
