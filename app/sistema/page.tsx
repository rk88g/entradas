import { redirect } from "next/navigation";
import { HomeDashboard } from "@/components/home-dashboard";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope } from "@/lib/utils";

export default async function SistemaPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/");
  }

  if (profile.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  if (
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "inicio",
      canAccessCoreSystem(profile.roleKey, profile.moduleOnly)
    )
  ) {
    redirect("/sistema/escaleras");
  }

  return <HomeDashboard user={profile} />;
}
