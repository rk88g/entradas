import { InternalBrowser } from "@/components/internal-browser";
import {
  getCurrentUserProfile,
  getInternalProfiles,
  getNextDate,
  getOpenDate
} from "@/lib/supabase/queries";

export default async function InternosPage() {
  const [profile, nextDate, openDate] = await Promise.all([
    getCurrentUserProfile(),
    getNextDate(),
    getOpenDate()
  ]);
  const profiles = await getInternalProfiles({
    nextDateValue: nextDate?.fechaCompleta,
    openDateValue: openDate?.fechaCompleta
  });

  return (
    <InternalBrowser
      profiles={profiles}
      nextDate={nextDate}
      openDate={openDate}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
