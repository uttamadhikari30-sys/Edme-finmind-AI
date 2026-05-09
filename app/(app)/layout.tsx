import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/shell/sidebar";
import Header from "@/components/shell/header";
import { OrgProvider } from "@/components/shell/org-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role, full_name, organizations(id, name, slug, currency)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const org = (membership.organizations as unknown) as { id: string; name: string; slug: string; currency: string };
  const fullName =
    membership.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "User";

  return (
    <OrgProvider value={{ orgId: org.id, orgName: org.name, role: membership.role, userName: fullName }}>
      <Sidebar userName={fullName} userRole={membership.role} />
      <Header title="FINMIND AI" orgName={org.name} />
      <main className="ml-[256px] pt-[66px] min-h-screen">
        <div className="p-6 page-in">{children}</div>
      </main>
    </OrgProvider>
  );
}
