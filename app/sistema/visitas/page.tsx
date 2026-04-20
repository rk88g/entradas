import { redirect } from "next/navigation";
import { VisitorManager } from "@/components/visitor-manager";
import { getCurrentUserProfile, getInternos, getVisitasPage } from "@/lib/supabase/queries";
import { canAccessCoreSystem } from "@/lib/utils";

export default async function VisitasPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = String(resolvedSearchParams.q ?? "").trim();
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const [profile, visitorsPage] = await Promise.all([
    getCurrentUserProfile(),
    getVisitasPage({
      query,
      page,
      pageSize: 20
    })
  ]);
  const internals = await getInternos(profile?.roleKey === "super-admin");

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  if (profile && !canAccessCoreSystem(profile.roleKey, profile.moduleOnly)) {
    redirect("/sistema/escaleras");
  }

  return (
    <VisitorManager
      visitors={visitorsPage.items}
      internals={internals}
      query={query}
      page={visitorsPage.page}
      totalPages={Math.max(1, Math.ceil(visitorsPage.total / visitorsPage.pageSize))}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
