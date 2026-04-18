import { VisitorManager } from "@/components/visitor-manager";
import { getCurrentUserProfile, getInternos, getOperatingDate, getVisitas } from "@/lib/supabase/queries";

export default async function VisitasPage() {
  const [profile, visitors, internals, operatingDate] = await Promise.all([
    getCurrentUserProfile(),
    getVisitas(),
    getInternos(),
    getOperatingDate()
  ]);

  return (
    <VisitorManager
      visitors={visitors}
      internals={internals}
      operatingDate={operatingDate?.fechaCompleta ?? null}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
