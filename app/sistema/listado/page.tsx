import { PassListing } from "@/components/pass-listing";
import { listado } from "@/lib/mock-data";
import { getStatsFromListings } from "@/lib/utils";

export default function ListadoPage() {
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
          <h3>Resaltado automático</h3>
          <p className="muted" style={{ color: "var(--muted)" }}>
            Las visitas menores de 12 años aparecen en rojo dentro del pase para revisión visual
            inmediata.
          </p>
        </article>
        <article className="quick-card">
          <h3>Historial consultable</h3>
          <p className="muted" style={{ color: "var(--muted)" }}>
            El listado conecta internos, visitas y fecha para poder revisar ingresos previos por
            interno o por visita.
          </p>
        </article>
      </section>

      <PassListing />
    </>
  );
}

