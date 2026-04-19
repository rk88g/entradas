import { redirect } from "next/navigation";
import { IntegratedModulePanel } from "@/components/integrated-module-panel";
import { getCurrentUserProfile, getInternos, getModulePanelData } from "@/lib/supabase/queries";
import { canAccessModule } from "@/lib/utils";

export default async function VisualPage() {
  const profile = await getCurrentUserProfile();
  const includeInactive = profile?.roleKey === "super-admin";
  const [data, internals] = await Promise.all([
    getModulePanelData("visual", includeInactive),
    getInternos(includeInactive)
  ]);

  if (!profile?.active || !canAccessModule(profile.roleKey, profile.accessibleModules, "visual")) {
    redirect("/sistema");
  }

  return (
    <IntegratedModulePanel
      data={data}
      internals={internals.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        ubicacion: item.ubicacion
      }))}
      roleKey={profile.roleKey}
      accesses={profile.accessibleModules}
    />
  );
}
