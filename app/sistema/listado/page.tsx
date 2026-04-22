import { redirect } from "next/navigation";
import { PassListing } from "@/components/pass-listing";
import {
  getCurrentUserProfile,
  getFechas,
  getListado,
  getNextDate,
  getOpenDate
} from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope, formatLongDate } from "@/lib/utils";

export default async function ListadoPage({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string; autoprint?: string; date?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [profile, openDate, nextDate, fechas] = await Promise.all([
    getCurrentUserProfile(),
    getOpenDate(),
    getNextDate(),
    getFechas()
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
  const requestedDate = String(resolvedSearchParams.date ?? "").trim();

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

  const canViewHistoricalListingDates = Boolean(
    profile &&
      canAccessScope(profile.roleKey, profile.permissionGrants, "listado.fechas-historicas", false)
  );
  const orderedDates = [...fechas].sort((left, right) => right.fechaCompleta.localeCompare(left.fechaCompleta));
  const operationalDates = orderedDates.filter(
    (date) => date.fechaCompleta === openDate?.fechaCompleta || date.fechaCompleta === nextDate?.fechaCompleta
  );
  const availableDates = canViewHistoricalListingDates ? orderedDates : operationalDates;
  const requestedDateAllowed = canViewHistoricalListingDates
    ? availableDates.some((date) => date.fechaCompleta === requestedDate)
    : operationalDates.some((date) => date.fechaCompleta === requestedDate);
  const selectedPrintDate =
    (requestedDateAllowed ? requestedDate : "") ||
    openDate?.fechaCompleta ||
    nextDate?.fechaCompleta ||
    availableDates[0]?.fechaCompleta ||
    "";

  const [currentPrintListings, waitingListings] = await Promise.all([
    selectedPrintDate ? getListado({ fechaVisita: selectedPrintDate }) : Promise.resolve([]),
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
          <h3>Listado seleccionado</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>{selectedPrintDate ? formatLongDate(selectedPrintDate) : "Sin fecha"}</strong>
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
        printDate={selectedPrintDate}
        availableDates={availableDates}
        showDateSelector={canViewHistoricalListingDates}
        initialMode={initialMode}
        autoPrint={autoPrint}
        roleKey={profile?.roleKey ?? "capturador"}
      />
    </>
  );
}
