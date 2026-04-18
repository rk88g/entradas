import { StatusBadge } from "@/components/status-badge";
import { getBetadas, getVisitas } from "@/lib/supabase/queries";

export default async function VisitasPage() {
  const [visitas, betadas] = await Promise.all([getVisitas(), getBetadas()]);

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Registro de visitas</strong>
          <span>Lectura real desde visitas con historial armado desde historial_ingresos.</span>
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
              {visitas.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay visitas para mostrar o falta permiso de lectura.</td>
                </tr>
              ) : (
                visitas.map((visitor) => (
                  <tr key={visitor.id}>
                    <td>
                      <div className="record-title">
                        <strong>{visitor.fullName}</strong>
                        <span>{visitor.fechaNacimiento}</span>
                      </div>
                    </td>
                    <td>{visitor.parentesco}</td>
                    <td>{visitor.edad}</td>
                    <td>{visitor.menor ? "Si" : "No"}</td>
                    <td>
                      <StatusBadge variant={visitor.betada ? "danger" : "ok"}>
                        {visitor.betada ? "Betada" : "Activa"}
                      </StatusBadge>
                    </td>
                    <td>{visitor.historialInterno.length ? visitor.historialInterno.join(", ") : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="form-card">
        <h3>Lista de betadas</h3>
        <p className="muted" style={{ color: "var(--muted)" }}>
          Esta lectura viene de la tabla betadas y sirve para validar bloqueos en captura.
        </p>
        <div className="mini-list" style={{ marginTop: "1rem" }}>
          {betadas.length === 0 ? (
            <div className="mini-row">
              <span>Sin registros activos</span>
              <strong>0</strong>
            </div>
          ) : (
            betadas.slice(0, 8).map((item) => (
              <div key={item.id} className="mini-row">
                <div className="record-title">
                  <strong>{item.fullName}</strong>
                  <span>{item.motivo}</span>
                </div>
                <StatusBadge variant={item.activo ? "danger" : "off"}>
                  {item.activo ? "Activa" : "Inactiva"}
                </StatusBadge>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

