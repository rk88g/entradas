import { VisitorManager } from "@/components/visitor-manager";
import { getInternos, getVisitas } from "@/lib/supabase/queries";

export default async function VisitasPage() {
  const [visitors, internals] = await Promise.all([getVisitas(), getInternos()]);

  return <VisitorManager visitors={visitors} internals={internals} />;
}
