import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import PageHeader from "@/components/ui/page-header";
import UsersClient from "@/components/admin/users-client";

export default async function UsersPage() {
  await requireUser();
  const supabase = createClient();

  const { data: membership } = (await supabase
    .from("org_members")
    .select("org_id, role")
    .limit(1)
    .single()) as { data: { org_id: string; role: string } | null };

  if (!membership) return null;
  const isAdmin = ["owner", "cfo"].includes(membership.role);

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("v_org_members_with_email")
      .select("*")
      .order("role"),
    isAdmin
      ? supabase
          .from("org_invites")
          .select("id, email, full_name, role, token, created_at, accepted_at")
          .eq("org_id", membership.org_id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle={
          isAdmin
            ? "Invite teammates, manage roles, and revoke access."
            : "Workspace members. Only admins can invite or change roles."
        }
      />
      <UsersClient
        orgId={membership.org_id}
        isAdmin={isAdmin}
        members={members ?? []}
        invites={invites ?? []}
      />
    </>
  );
}
