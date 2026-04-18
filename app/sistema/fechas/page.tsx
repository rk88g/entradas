import { DateOperations } from "@/components/date-operations";
import { getFechas, getOperatingDate } from "@/lib/supabase/queries";

export default async function FechasPage() {
  const [dates, operatingDate] = await Promise.all([getFechas(), getOperatingDate()]);

  return <DateOperations dates={dates} operatingDate={operatingDate} />;
}

