import { redirect } from "next/navigation";
import { PassListing } from "@/components/pass-listing";
import { getCurrentUserProfile, getListingBuilderData, getListado } from "@/lib/supabase/queries";
import { formatLongDate } from "@/lib/utils";

export default async function ListadoPage() {
  const [profile, builderData, listado] = await Promise.all([
    getCurrentUserProfile(),
    getListingBuilderData(),
    getListado()
  ]);

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  const printDate = builderData.printDate?.fechaCompleta ?? "";
  const waitingDate = builderData.nextDate?.fechaCompleta ?? "";
  const currentPrintListings = listado.filter((item) => item.fechaVisita === printDate);
  const waitingListings = listado.filter((item) => item.fechaVisita === waitingDate);

  return (
    <>
      <section className="quick-grid hide-print">
        <article className="quick-card">
          <h3>Mañana</h3>
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
          <h3>618</h3>
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
