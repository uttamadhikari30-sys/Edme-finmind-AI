import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import BusinessUnitsClient from "@/components/admin/business-units-client";

export const dynamic = "force-dynamic";

export default async function BusinessUnitsPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };
  if (!membership) return null;

  const isAdmin = ["owner", "cfo"].includes(membership.role);
  const orgId = membership.org_id;

  const [{ data: bus }, { data: members }] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, code, name, description, manager_user_id, is_active")
      .eq("org_id", orgId)
      .order("code"),
    supabase.from("v_org_members_with_email").select("user_id, full_name, email, role"),
  ]);

  return (
    <>
      <PageHeader
        title="Business Verticals"
        subtitle={
          isAdmin
            ? "Manage Edme's verticals · add, edit, deactivate · assign Business Heads"
            : "Read-only — your verticals across Edme. Admins can edit."
        }
      />
      <BusinessUnitsClient
        orgId={orgId}
        isAdmin={isAdmin}
        verticals={(bus as any[]) ?? []}
        members={(members as any[]) ?? []}
      />
    </>
  );
}
