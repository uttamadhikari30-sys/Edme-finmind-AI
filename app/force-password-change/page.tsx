import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ForcePasswordChangeForm from "./form";

export const dynamic = "force-dynamic";

export default async function ForcePasswordChangePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mustChange = Boolean(user.user_metadata?.must_change_password);
  if (!mustChange) redirect("/dashboard");

  return <ForcePasswordChangeForm userEmail={user.email ?? ""} />;
}
