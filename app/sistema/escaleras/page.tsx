import { redirect } from "next/navigation";
import { EscalerasPanel } from "@/components/escaleras-panel";
import { getCurrentUserProfile, getEscalerasPanelData } from "@/lib/supabase/queries";
import { canAccessModule } from "@/lib/utils";

export default async function EscalerasPage() {
  const profile = await getCurrentUserProfile();

  if (!profile?.active || !canAccessModule(profile.roleKey, profile.accessibleModules, "escaleras")) {
    redirect("/sistema");
  }

  const includeInactive = profile.roleKey === "super-admin";
  const data = await getEscalerasPanelData(includeInactive);

  return <EscalerasPanel records={data} roleKey={profile.roleKey} />;
}
