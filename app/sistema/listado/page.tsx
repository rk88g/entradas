import { redirect } from "next/navigation";
import { PassListing } from "@/components/pass-listing";
import {
  getCurrentUserProfile,
  getListado,
  getNextDate,
  getOpenDate
} from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope, formatLongDate } from "@/lib/utils";

export default async function ListadoPage({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string; autoprint?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [profile, openDate, nextDate] = await Promise.all([
    getCurrentUserProfile(),
    getOpenDate(),
    getNextDate()
  ]);
  const requestedMode = String(resolvedSearchParams.mode ?? "").trim();
  const initialMode =
    requestedMode === "listado" ||
    requestedMode === "sexos" ||
    requestedMode === "numeros" ||
    requestedMode === "menciones"
      ? requestedMode
      : "listado";
  const autoPrint = String(resolvedSearchParams.autoprint ?? "") === "1";

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  if (
    profile &&
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "listado",
      canAccessCoreSystem(profile.roleKey, profile.moduleOnly)
    )
  ) {
    redirect("/sistema/escaleras");
  }

  const [currentPrintListings, waitingListings] = await Promise.all([
    openDate ? getListado({ fechaVisita: openDate.fechaCompleta }) : Promise.resolve([]),
    nextDate ? getListado({ fechaVisita: nextDate.fechaCompleta }) : Promise.resolve([])
  ]);

  return (
    <>
      <section className="quick-grid hide-print">
        <article className="quick-card">
          <h3>En espera</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>{nextDate ? formatLongDate(nextDate.fechaCompleta) : "Sin fecha"}</strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{waitingListings.length}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>Manana</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>{openDate ? formatLongDate(openDate.fechaCompleta) : "Sin fecha"}</strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{currentPrintListings.length}</strong>
            </div>
          </div>
        </article>
      </section>

      <PassListing
        listings={currentPrintListings}
        printDate={openDate?.fechaCompleta ?? ""}
        initialMode={initialMode}
        autoPrint={autoPrint}
      />
    </>
  );
}
