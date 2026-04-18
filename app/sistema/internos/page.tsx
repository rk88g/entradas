import { InternalBrowser } from "@/components/internal-browser";
import { getInternalProfiles, getOperatingDate, getVisitas } from "@/lib/supabase/queries";

export default async function InternosPage() {
  const operatingDate = await getOperatingDate();
  const [profiles, visitors] = await Promise.all([
    getInternalProfiles(operatingDate?.fechaCompleta),
    getVisitas()
  ]);

  return (
    <InternalBrowser
      profiles={profiles}
      availableVisitors={visitors}
      operatingDate={operatingDate?.fechaCompleta ?? null}
    />
  );
}
