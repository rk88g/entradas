import { redirect } from "next/navigation";
import { VisitorManager } from "@/components/visitor-manager";
import { getCurrentUserProfile, getVisitasPage } from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope, canViewSensitiveSystemData } from "@/lib/utils";

export default async function VisitasPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = String(resolvedSearchParams.q ?? "").trim();
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const profile = await getCurrentUserProfile();

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  if (
    profile &&
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "visitas",
      canAccessCoreSystem(profile.roleKey, profile.moduleOnly)
    )
  ) {
    redirect("/sistema/escaleras");
  }

  const availability = profile?.roleKey === "super-admin" ? "all" : "active";
  const visitorsPage = await getVisitasPage({
    query,
    page,
    pageSize: 100,
    availability,
    includeHistory: false
  });
  return (
    <VisitorManager
      visitors={visitorsPage.items}
      query={query}
      page={visitorsPage.page}
      totalPages={Math.max(1, Math.ceil(visitorsPage.total / visitorsPage.pageSize))}
      roleKey={profile?.roleKey ?? "capturador"}
      canViewSensitiveData={canViewSensitiveSystemData(profile?.roleKey ?? "capturador", profile?.id)}
      title="Visitas"
      showCreateSection
    />
  );
}
