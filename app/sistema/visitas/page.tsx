import { visitas } from "@/lib/mock-data";
import { sortVisitorsByAge } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export default function VisitasPage() {
  const orderedVisitors = sortVisitorsByAge(visitas);

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Registro de visitas</strong>
          <span>Consulta rápida con validación de edad, parentesco y estatus de betada.</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Visita</th>
                <th>Parentesco</th>
                <th>Edad</th>
                <th>Menor</th>
                <th>Betada</th>
                <th>Historial</th>
              </tr>
            </thead>
            <tbody>
              {orderedVisitors.map((visitor) => (
                <tr key={visitor.id}>
                  <td>
                    <div className="record-title">
                      <strong>{visitor.fullName}</strong>
                      <span>{visitor.fechaNacimiento}</span>
                    </div>
                  </td>
                  <td>{visitor.parentesco}</td>
                  <td>{visitor.edad}</td>
                  <td>{visitor.menor ? "Sí" : "No"}</td>
                  <td>
                    <StatusBadge variant={visitor.betada ? "danger" : "ok"}>
                      {visitor.betada ? "Betada" : "Activa"}
                    </StatusBadge>
                  </td>
                  <td>{visitor.historialInterno.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="form-card">
        <h3>Alta de visita</h3>
        <p className="muted" style={{ color: "var(--muted)" }}>
          El flujo considera la lista de betadas para impedir que una persona bloqueada se capture
          como visita válida.
        </p>

        <div className="field-grid" style={{ marginTop: "1rem" }}>
          <div className="field">
            <label htmlFor="vnombres">Nombres</label>
            <input id="vnombres" placeholder="Maria Fernanda" />
          </div>
          <div className="field">
            <label htmlFor="vapepat">Apellido paterno</label>
            <input id="vapepat" placeholder="Lopez" />
          </div>
          <div className="field">
            <label htmlFor="vapemat">Apellido materno</label>
            <input id="vapemat" placeholder="Ruiz" />
          </div>
          <div className="field">
            <label htmlFor="vfecha">Fecha de nacimiento</label>
            <input id="vfecha" type="date" />
          </div>
          <div className="field">
            <label htmlFor="vparentesco">Parentesco</label>
            <input id="vparentesco" placeholder="Esposa" />
          </div>
          <div className="field">
            <label htmlFor="vinterno">Interno relacionado</label>
            <input id="vinterno" placeholder="Carlos Mendoza Rivas" />
          </div>
          <div className="field">
            <label htmlFor="vbetada">Estatus</label>
            <select id="vbetada" defaultValue="false">
              <option value="false">Activa</option>
              <option value="true">Betada</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="vmotivo">Motivo de bloqueo o notas</label>
            <textarea id="vmotivo" placeholder="Incidencia previa, observaciones, etc." />
          </div>
        </div>
        <div className="actions-row" style={{ marginTop: "1rem" }}>
          <button type="button" className="button">
            Guardar visita
          </button>
          <button type="button" className="button-soft">
            Agregar a betadas
          </button>
        </div>
      </article>
    </section>
  );
}

