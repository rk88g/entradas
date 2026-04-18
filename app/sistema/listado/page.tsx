import { PassListing } from "@/components/pass-listing";
import { getListado } from "@/lib/supabase/queries";
import { getStatsFromListings } from "@/lib/utils";

export default async function ListadoPage() {
  const listado = await getListado();
  const stats = getStatsFromListings(listado);

  return (
    <>
      <section className="quick-grid hide-print">
        <article className="quick-card">
          <h3>Pases por apartado</h3>
          <div className="mini-list">
            <div className="mini-row">
              <span>618</span>
              <strong>{stats.areas["618"] ?? 0}</strong>
            </div>
            <div className="mini-row">
              <span>INTIMA</span>
              <strong>{stats.areas.INTIMA ?? 0}</strong>
            </div>
          </div>
        </article>
        <article className="quick-card">
          <h3>Origen</h3>
          <p className="muted" style={{ color: "var(--muted)" }}>
            Datos armados desde listado, listado_visitas, internos y visitas.
          </p>
        </article>
        <article className="quick-card">
          <h3>Historial consultable</h3>
          <p className="muted" style={{ color: "var(--muted)" }}>
            La impresion y el historial ya salen de tu base con agrupacion por interno.
          </p>
        </article>
      </section>

      <PassListing listings={listado} />
    </>
  );
}

