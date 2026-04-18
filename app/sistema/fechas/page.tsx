import { DateOperations } from "@/components/date-operations";
import { getClosePasswordConfigured, getCurrentUserProfile, getFechas, getOperatingDate } from "@/lib/supabase/queries";

export default async function FechasPage() {
  const [profile, dates, operatingDate, closePasswordConfigured] = await Promise.all([
    getCurrentUserProfile(),
    getFechas(),
    getOperatingDate(),
    getClosePasswordConfigured()
  ]);

  return (
    <DateOperations
      dates={dates}
      operatingDate={operatingDate}
      roleKey={profile?.roleKey ?? "capturador"}
      closePasswordConfigured={closePasswordConfigured}
    />
  );
}
