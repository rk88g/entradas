import { redirect } from "next/navigation";
import { VisitorManager } from "@/components/visitor-manager";
import { getCurrentUserProfile, getVisitasPage } from "@/lib/supabase/queries";
import { canViewSensitiveSystemData } from "@/lib/utils";

export default async function BetadasPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = String(resolvedSearchParams.q ?? "").trim();
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const profile = await getCurrentUserProfile();

  if (!profile?.active || profile.roleKey !== "super-admin") {
    redirect("/sistema/visitas");
  }

  const visitorsPage = await getVisitasPage({
    query,
    page,
    pageSize: 100,
    availability: "unavailable"
  });

  return (
    <VisitorManager
      visitors={visitorsPage.items}
      query={query}
      page={visitorsPage.page}
      totalPages={Math.max(1, Math.ceil(visitorsPage.total / visitorsPage.pageSize))}
      roleKey={profile.roleKey}
      canViewSensitiveData={canViewSensitiveSystemData(profile.roleKey, profile.id)}
      title="Betadas"
      showCreateSection={false}
    />
  );
}
