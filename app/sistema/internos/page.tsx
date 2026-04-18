import { InternalBrowser } from "@/components/internal-browser";
import { getCurrentUserProfile, getInternalProfiles, getOperatingDate } from "@/lib/supabase/queries";

export default async function InternosPage() {
  const operatingDate = await getOperatingDate();
  const [profile, profiles] = await Promise.all([
    getCurrentUserProfile(),
    getInternalProfiles(operatingDate?.fechaCompleta)
  ]);

  return (
    <InternalBrowser
      profiles={profiles}
      operatingDate={operatingDate?.fechaCompleta ?? null}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
