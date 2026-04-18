import { PassListing } from "@/components/pass-listing";
import { getListingBuilderData, getListado } from "@/lib/supabase/queries";
import { formatLongDate, getStatsFromListings } from "@/lib/utils";

export default async function ListadoPage() {
  const builderData = await getListingBuilderData();
  const listado = await getListado();
  const stats = getStatsFromListings(listado);
  const nextDateValue = builderData.nextDate?.fechaCompleta ?? "";
  const openDateValue = builderData.openDate?.fechaCompleta ?? "";
  const nextDateListings = listado.filter(
    (item) => item.fechaVisita === nextDateValue && item.area === "618"
  );
  const openDateListings = listado.filter(
    (item) => item.fechaVisita === openDateValue && item.area === "INTIMA"
  );

  return (
    <>
      <section className="quick-grid hide-print">
        <article className="quick-card">
          <h3>Fecha 618</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>
                {builderData.nextDate ? formatLongDate(builderData.nextDate.fechaCompleta) : "Sin fecha proximo"}
              </strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{nextDateListings.length}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>Pases sueltos</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>
                {builderData.openDate ? formatLongDate(builderData.openDate.fechaCompleta) : "Sin fecha abierta"}
              </strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{openDateListings.length}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>Total</h3>
          <strong style={{ fontSize: "2rem" }}>{stats.totalPasses}</strong>
        </article>
      </section>

      <PassListing
        listings={listado}
        nextDate={nextDateValue}
        openDate={openDateValue}
      />
    </>
  );
}
