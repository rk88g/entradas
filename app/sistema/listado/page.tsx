import { PassListing } from "@/components/pass-listing";
import { getListingBuilderData, getListado } from "@/lib/supabase/queries";
import { formatLongDate, getStatusDisplayLabel } from "@/lib/utils";

export default async function ListadoPage() {
  const builderData = await getListingBuilderData();
  const listado = await getListado();
  const printDate = builderData.printDate?.fechaCompleta ?? "";
  const waitingDate = builderData.nextDate?.fechaCompleta ?? "";
  const currentPrintListings = listado.filter((item) => item.fechaVisita === printDate);
  const waitingListings = listado.filter((item) => item.fechaVisita === waitingDate);

  return (
    <>
      <section className="quick-grid hide-print">
        <article className="quick-card">
          <h3>{builderData.openDate ? getStatusDisplayLabel(builderData.openDate.estado) : "PROXIMOS"}</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>
                {builderData.openDate ? formatLongDate(builderData.openDate.fechaCompleta) : "Sin fecha"}
              </strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{currentPrintListings.length}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>{builderData.nextDate ? getStatusDisplayLabel(builderData.nextDate.estado) : "EN ESPERA"}</h3>
          <div className="mini-list">
            <div className="mini-row">
              <strong>
                {builderData.nextDate ? formatLongDate(builderData.nextDate.fechaCompleta) : "Sin fecha"}
              </strong>
            </div>
            <div className="mini-row">
              <span>Pases</span>
              <strong>{waitingListings.length}</strong>
            </div>
          </div>
        </article>
      </section>

      <PassListing listings={listado} printDate={printDate} />
    </>
  );
}
