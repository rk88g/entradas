import { internos } from "@/lib/mock-data";
import { formatShortDate } from "@/lib/utils";

export default function InternosPage() {
  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Catálogo de internos</strong>
          <span>Base maestra para solicitar pases y consultar historial.</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Interno</th>
                <th>Ubicación</th>
                <th>Filiación</th>
                <th>Llegó</th>
                <th>Libre</th>
                <th>Clasificación</th>
              </tr>
            </thead>
            <tbody>
              {internos.map((interno) => (
                <tr key={interno.id}>
                  <td>
                    <div className="record-title">
                      <strong>{interno.fullName}</strong>
                      <span>{interno.expediente}</span>
                    </div>
                  </td>
                  <td>{interno.ubicacion}</td>
                  <td>{interno.ubiFiliacion}</td>
                  <td>{formatShortDate(interno.llego)}</td>
                  <td>{formatShortDate(interno.libre)}</td>
                  <td>{interno.clasificacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="form-card">
        <h3>Alta rápida de interno</h3>
        <p className="muted" style={{ color: "var(--muted)" }}>
          Pensado para capturar sin demasiados pasos: datos esenciales primero y observaciones al
          final.
        </p>
        <div className="field-grid" style={{ marginTop: "1rem" }}>
          <div className="field">
            <label htmlFor="nombres">Nombres</label>
            <input id="nombres" placeholder="Carlos" />
          </div>
          <div className="field">
            <label htmlFor="apellido-pat">Apellido paterno</label>
            <input id="apellido-pat" placeholder="Mendoza" />
          </div>
          <div className="field">
            <label htmlFor="apellido-mat">Apellido materno</label>
            <input id="apellido-mat" placeholder="Rivas" />
          </div>
          <div className="field">
            <label htmlFor="nacimiento">Nacimiento</label>
            <input id="nacimiento" type="date" />
          </div>
          <div className="field">
            <label htmlFor="llego">Llegó</label>
            <input id="llego" type="date" />
          </div>
          <div className="field">
            <label htmlFor="libre">Libre</label>
            <input id="libre" type="date" />
          </div>
          <div className="field">
            <label htmlFor="ubicacion">Ubicación numérica</label>
            <input id="ubicacion" type="number" placeholder="618" />
          </div>
          <div className="field">
            <label htmlFor="filiacion">Ubi. filiación</label>
            <input id="filiacion" placeholder="Terraza Norte" />
          </div>
          <div className="field">
            <label htmlFor="clasificacion">Apartado</label>
            <select id="clasificacion" defaultValue="618">
              <option value="618">Pases 618</option>
              <option value="INTIMA">Pases sueltos INTIMA</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="expediente">Expediente</label>
            <input id="expediente" placeholder="EXP-618-101" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" placeholder="Notas importantes para operación..." />
          </div>
        </div>
        <div className="actions-row" style={{ marginTop: "1rem" }}>
          <button type="button" className="button">
            Guardar interno
          </button>
          <button type="button" className="button-soft">
            Limpiar captura
          </button>
        </div>
      </article>
    </section>
  );
}

