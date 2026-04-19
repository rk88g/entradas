import { redirect } from "next/navigation";
import { IntegratedModulePanel } from "@/components/integrated-module-panel";
import { getCurrentUserProfile, getInternos, getModulePanelData } from "@/lib/supabase/queries";
import { canAccessModule } from "@/lib/utils";

export default async function ComunicacionPage() {
  const [profile, data, internals] = await Promise.all([
    getCurrentUserProfile(),
    getModulePanelData("comunicacion"),
    getInternos()
  ]);

  if (!profile?.active || !canAccessModule(profile.roleKey, profile.accessibleModules, "comunicacion")) {
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
