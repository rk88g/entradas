import { StatusBadge } from "@/components/status-badge";
import { getFechas } from "@/lib/supabase/queries";
import { formatLongDate } from "@/lib/utils";

export default async function FechasPage() {
  const fechas = await getFechas();

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Control de fechas</strong>
          <span>Lectura directa desde la tabla fechas.</span>
        </div>

        <div className="calendar-grid">
          {fechas.length === 0 ? (
            <article className="calendar-card">
              <h3>Sin fechas cargadas</h3>
              <p className="muted" style={{ color: "var(--muted)" }}>
                Agrega registros en la tabla fechas para ver la operacion diaria.
              </p>
            </article>
          ) : (
            fechas.map((fecha) => (
              <article key={fecha.id} className="calendar-card">
                <div className="record-title">
                  <strong>{formatLongDate(fecha.fechaCompleta)}</strong>
                  <span>
                    {fecha.dia}/{fecha.mes}/{fecha.anio}
                  </span>
                </div>
                <div className="chips-row">
                  <StatusBadge
                    variant={
                      fecha.estado === "abierto"
                        ? "ok"
                        : fecha.estado === "proximo"
                          ? "warn"
                          : "off"
                    }
                  >
                    {fecha.estado}
                  </StatusBadge>
                  <span className="chip">{fecha.cierre ? "Cierre activo" : "Captura habilitada"}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </article>

      <article className="form-card">
        <h3>Estado de conexion</h3>
        <div className="mini-list" style={{ marginTop: "1rem" }}>
          <div className="mini-row">
            <span>Fuente</span>
            <strong>Supabase / fechas</strong>
          </div>
          <div className="mini-row">
            <span>Registros visibles</span>
            <strong>{fechas.length}</strong>
          </div>
          <div className="mini-row">
            <span>Uso</span>
            <strong>Apertura y cierre de operacion</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
