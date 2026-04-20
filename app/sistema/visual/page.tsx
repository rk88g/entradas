import { redirect } from "next/navigation";
import { IntegratedModulePanel } from "@/components/integrated-module-panel";
import { getCurrentUserProfile, getModulePanelData } from "@/lib/supabase/queries";
import { canAccessModule, canAccessScope } from "@/lib/utils";

export default async function VisualPage() {
  const profile = await getCurrentUserProfile();
  const includeInactive = profile?.roleKey === "super-admin";
  const data = await getModulePanelData("visual", includeInactive);

  if (
    !profile?.active ||
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "visual",
      canAccessModule(profile.roleKey, profile.accessibleModules, "visual")
    )
  ) {
    redirect("/sistema");
  }

  return (
    <IntegratedModulePanel
      data={data}
      roleKey={profile.roleKey}
      accesses={profile.accessibleModules}
      permissionGrants={profile.permissionGrants}
    />
  );
}
