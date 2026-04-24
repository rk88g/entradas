import { redirect } from "next/navigation";
import { ComparatorPanel } from "@/components/comparator-panel";
import { getCurrentUserProfile, getInternalProfilesPage, getVisitasPage } from "@/lib/supabase/queries";

export default async function ComparadorPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; iq?: string; vq?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const fallbackQuery = String(resolvedSearchParams.q ?? "").trim();
  const internalQuery = String(resolvedSearchParams.iq ?? fallbackQuery).trim();
  const visitorQuery = String(resolvedSearchParams.vq ?? fallbackQuery).trim();
  const profile = await getCurrentUserProfile();

  if (!profile?.active || profile.roleKey !== "super-admin") {
    redirect("/sistema");
  }

  const [internalsPage, visitorsPage] = await Promise.all([
    getInternalProfilesPage({
      query: internalQuery,
      page: 1,
      pageSize: 20,
      includeInactive: true,
      includeBetadasVisitors: true
    }),
    getVisitasPage({
      query: visitorQuery,
      page: 1,
      pageSize: 20,
      availability: "all"
    })
  ]);

  return (
    <ComparatorPanel
      internals={internalsPage.items}
      visitors={visitorsPage.items}
      internalQuery={internalQuery}
      visitorQuery={visitorQuery}
    />
  );
}
