import { redirect } from "next/navigation";
import { VisitorManager } from "@/components/visitor-manager";
import {
  getCurrentUserProfile,
  getInternos,
  getNextDate,
  getOpenDate,
  getVisitas
} from "@/lib/supabase/queries";

export default async function VisitasPage() {
  const [profile, visitors, internals, nextDate, openDate] = await Promise.all([
    getCurrentUserProfile(),
    getVisitas(),
    getInternos(),
    getNextDate(),
    getOpenDate()
  ]);

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  return (
    <VisitorManager
      visitors={visitors}
      internals={internals}
      operatingDate={nextDate?.fechaCompleta ?? openDate?.fechaCompleta ?? null}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
