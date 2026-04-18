import { fechas } from "@/lib/mock-data";
import { formatLongDate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export default function FechasPage() {
  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Control de fechas</strong>
          <span>
            Apertura, cierre y preparación anticipada de pases para mantener lista la operación.
          </span>
        </div>

        <div className="calendar-grid">
          {fechas.map((fecha) => (
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
          ))}
        </div>
      </article>

      <article className="form-card">
        <h3>Administrar fecha de operación</h3>
        <div className="field-grid" style={{ marginTop: "1rem" }}>
          <div className="field">
            <label htmlFor="fecha-operacion">Fecha completa</label>
            <input id="fecha-operacion" type="date" />
          </div>
          <div className="field">
            <label htmlFor="estado-operacion">Estado</label>
            <select id="estado-operacion" defaultValue="abierto">
              <option value="abierto">Abierto</option>
              <option value="proximo">Próximo</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cierre-operacion">Cierre</label>
            <select id="cierre-operacion" defaultValue="false">
              <option value="false">Sin cierre</option>
              <option value="true">Cerrar captura</option>
            </select>
          </div>
        </div>

        <div className="actions-row" style={{ marginTop: "1rem" }}>
          <button type="button" className="button">
            Guardar fecha
          </button>
          <button type="button" className="button-soft">
            Abrir siguiente día
          </button>
        </div>
      </article>
    </section>
  );
}

