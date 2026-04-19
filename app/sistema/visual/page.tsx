import { redirect } from "next/navigation";
import { IntegratedModulePanel } from "@/components/integrated-module-panel";
import { getCurrentUserProfile, getInternos, getModulePanelData } from "@/lib/supabase/queries";
import { canAccessModule } from "@/lib/utils";

export default async function VisualPage() {
  const [profile, data, internals] = await Promise.all([
    getCurrentUserProfile(),
    getModulePanelData("visual"),
    getInternos()
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
