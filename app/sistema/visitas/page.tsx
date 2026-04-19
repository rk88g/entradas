import { redirect } from "next/navigation";
import { VisitorManager } from "@/components/visitor-manager";
import { getCurrentUserProfile, getInternos, getVisitas } from "@/lib/supabase/queries";

export default async function VisitasPage() {
  const [profile, visitors] = await Promise.all([
    getCurrentUserProfile(),
    getVisitas()
  ]);
  const internals = await getInternos(profile?.roleKey === "super-admin");

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  return (
    <VisitorManager
      visitors={visitors}
      internals={internals}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
