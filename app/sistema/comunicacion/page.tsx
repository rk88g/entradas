import { redirect } from "next/navigation";
import { IntegratedModulePanel } from "@/components/integrated-module-panel";
import { getCurrentUserProfile, getModulePanelData } from "@/lib/supabase/queries";
import { canAccessModule } from "@/lib/utils";

export default async function ComunicacionPage() {
  const profile = await getCurrentUserProfile();
  const includeInactive = profile?.roleKey === "super-admin";
  const data = await getModulePanelData("comunicacion", includeInactive);

  if (!profile?.active || !canAccessModule(profile.roleKey, profile.accessibleModules, "comunicacion")) {
    redirect("/sistema");
  }

  return (
    <IntegratedModulePanel
      data={data}
      roleKey={profile.roleKey}
      accesses={profile.accessibleModules}
    />
  );
}
