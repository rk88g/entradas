import { VisitorManager } from "@/components/visitor-manager";
import { getInternos, getOperatingDate, getVisitas } from "@/lib/supabase/queries";

export default async function VisitasPage() {
  const [visitors, internals, operatingDate] = await Promise.all([
    getVisitas(),
    getInternos(),
    getOperatingDate()
  ]);

  return (
    <VisitorManager
      visitors={visitors}
      internals={internals}
      operatingDate={operatingDate?.fechaCompleta ?? null}
    />
  );
}
