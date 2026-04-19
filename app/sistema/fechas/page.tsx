import { redirect } from "next/navigation";
import { DateOperations } from "@/components/date-operations";
import {
  getClosePasswordConfigured,
  getCurrentUserProfile,
  getFechas,
  getNextDate,
  getOpenDate
} from "@/lib/supabase/queries";

export default async function FechasPage() {
  const [profile, dates, nextDate, openDate, closePasswordConfigured] = await Promise.all([
    getCurrentUserProfile(),
    getFechas(),
    getNextDate(),
    getOpenDate(),
    getClosePasswordConfigured()
  ]);

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  return (
    <DateOperations
      dates={dates}
      nextDate={nextDate}
      openDate={openDate}
      roleKey={profile?.roleKey ?? "capturador"}
      closePasswordConfigured={closePasswordConfigured}
    />
  );
}
