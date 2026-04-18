import { PassListing } from "@/components/pass-listing";
import { PassOperations } from "@/components/pass-operations";
import { getCurrentUserProfile, getListingBuilderData, getListado } from "@/lib/supabase/queries";
import { getStatsFromListings } from "@/lib/utils";

export default async function ListadoPage() {
  const profile = await getCurrentUserProfile();
  const builderData = await getListingBuilderData();
  const selectedDate = builderData.operatingDate?.fechaCompleta ?? builderData.todayDate?.fechaCompleta ?? "";
  const listado = await getListado(selectedDate ? { fechaVisita: selectedDate } : undefined);
  const stats = getStatsFromListings(listado);

  return (
    <>
      <section className="quick-grid hide-print">
        <article className="quick-card">
          <h3>Fecha en operación</h3>
          <div className="mini-list">
            <div className="mini-row">
              <span>Fecha</span>
              <strong>{builderData.operatingDate?.fechaCompleta ?? "Sin fecha abierta"}</strong>
            </div>
            <div className="mini-row">
              <span>Pases en listado</span>
              <strong>{stats.totalPasses}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>Operación diaria</h3>
          <p className="muted" style={{ color: "var(--muted)" }}>
            El sistema ya indica duplicados para la fecha abierta y muestra las visitas del día
            actual para aclaraciones rápidas.
          </p>
        </article>
        <article className="quick-card">
          <h3>Reglas activas</h3>
          <p className="muted" style={{ color: "var(--muted)" }}>
            Menciones solo para control y super-admin. El capturador genera únicamente pases 618.
          </p>
        </article>
      </section>

      <PassOperations
        operatingDate={builderData.operatingDate}
        profiles={builderData.internalProfiles}
        todaysPasses={builderData.todaysPasses}
        roleKey={profile?.roleKey ?? "capturador"}
      />

      <PassListing listings={listado} initialDate={selectedDate} />
    </>
  );
}
