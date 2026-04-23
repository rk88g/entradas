import { redirect } from "next/navigation";
import { InternalBrowser } from "@/components/internal-browser";
import {
  getCurrentUserProfile,
  getFechas,
  getInternalProfilesPage,
  getNextDate,
  getOpenDate,
  getPassDeviceTypes
} from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope, canViewSensitiveSystemData } from "@/lib/utils";

export default async function InternosPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = String(resolvedSearchParams.q ?? "").trim();
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const [profile, openDate, nextDate, passArticles, fechas] = await Promise.all([
    getCurrentUserProfile(),
    getOpenDate(),
    getNextDate(),
    getPassDeviceTypes(),
    getFechas()
  ]);

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  if (
    profile &&
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "internos",
      canAccessCoreSystem(profile.roleKey, profile.moduleOnly)
    )
  ) {
    redirect("/sistema/escaleras");
  }

  const paged = await getInternalProfilesPage({
    query,
    page,
    pageSize: 100,
    includeInactive: profile?.roleKey === "super-admin",
    openDateValue: openDate?.fechaCompleta,
    nextDateValue: nextDate?.fechaCompleta
  });
  const extraPassDates = [...fechas]
    .filter((date) => profile?.roleKey === "super-admin" || !date.cierre)
    .sort((left, right) => right.fechaCompleta.localeCompare(left.fechaCompleta))
    .slice(0, 6);

  return (
    <InternalBrowser
      profiles={paged.items}
      query={query}
      page={paged.page}
      totalPages={Math.max(1, Math.ceil(paged.total / paged.pageSize))}
      nextDate={nextDate}
      openDate={openDate}
      extraDates={extraPassDates}
      passArticles={passArticles}
      roleKey={profile?.roleKey ?? "capturador"}
      canViewSensitiveData={canViewSensitiveSystemData(profile?.roleKey ?? "capturador", profile?.id)}
    />
  );
}
