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
          <h3>Fecha</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>{builderData.operatingDate?.fechaCompleta ?? "Sin fecha abierta"}</strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{stats.totalPasses}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>618</h3>
          <strong style={{ fontSize: "2rem" }}>{stats.areas["618"] ?? 0}</strong>
        </article>
        <article className="quick-card">
          <h3>Sueltos</h3>
          <strong style={{ fontSize: "2rem" }}>{stats.areas.INTIMA ?? 0}</strong>
        </article>
      </section>

      <PassOperations
        operatingDate={builderData.operatingDate}
        profiles={builderData.internalProfiles}
        todaysPasses={builderData.todaysPasses}
        roleKey={profile?.roleKey ?? "capturador"}
        closePasswordConfigured={builderData.closePasswordConfigured}
      />

      <PassListing listings={listado} initialDate={selectedDate} />
    </>
  );
}
