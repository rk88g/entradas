import { redirect } from "next/navigation";
import { AduanaPanel } from "@/components/escaleras-panel";
import { getAduanaPanelData, getCurrentUserProfile } from "@/lib/supabase/queries";
import { canAccessModule, canAccessScope } from "@/lib/utils";

export default async function AduanaPage() {
  const profile = await getCurrentUserProfile();

  if (
    !profile?.active ||
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "aduana",
      profile.roleKey !== "control" && canAccessModule(profile.roleKey, profile.accessibleModules, "escaleras")
    )
  ) {
    redirect("/sistema");
  }

  const includeInactive = profile.roleKey === "super-admin";
  const data = await getAduanaPanelData(includeInactive);

  return <AduanaPanel records={data} />;
}
