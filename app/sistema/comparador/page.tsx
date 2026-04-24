import { redirect } from "next/navigation";
import { ComparatorPanel } from "@/components/comparator-panel";
import { getCurrentUserProfile, getInternalProfilesPage, getVisitasPage } from "@/lib/supabase/queries";

export default async function ComparadorPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = String(resolvedSearchParams.q ?? "").trim();
  const profile = await getCurrentUserProfile();

  if (!profile?.active || profile.roleKey !== "super-admin") {
    redirect("/sistema");
  }

  const [internalsPage, visitorsPage] = await Promise.all([
    getInternalProfilesPage({
      query,
      page: 1,
      pageSize: 20,
      includeInactive: true,
      includeBetadasVisitors: true
    }),
    getVisitasPage({
      query,
      page: 1,
      pageSize: 20,
      availability: "all"
    })
  ]);

  return (
    <ComparatorPanel
      internals={internalsPage.items}
      visitors={visitorsPage.items}
      query={query}
    />
  );
}
