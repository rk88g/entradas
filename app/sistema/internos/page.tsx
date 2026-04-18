import { getInternos } from "@/lib/supabase/queries";
import { formatShortDate } from "@/lib/utils";

export default async function InternosPage() {
  const internos = await getInternos();

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Catalogo de internos</strong>
          <span>Lectura directa desde la tabla internos.</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Interno</th>
                <th>Ubicacion</th>
                <th>Filiacion</th>
                <th>Llego</th>
                <th>Libre</th>
                <th>Apartado</th>
              </tr>
            </thead>
            <tbody>
              {internos.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay internos registrados o tu politica RLS no los permite ver.</td>
                </tr>
              ) : (
                internos.map((interno) => (
                  <tr key={interno.id}>
                    <td>
                      <div className="record-title">
                        <strong>{interno.fullName}</strong>
                        <span>{interno.expediente}</span>
                      </div>
                    </td>
                    <td>{interno.ubicacion}</td>
                    <td>{interno.ubiFiliacion}</td>
                    <td>{interno.llego ? formatShortDate(interno.llego) : "-"}</td>
                    <td>{interno.libre ? formatShortDate(interno.libre) : "-"}</td>
                    <td>{interno.clasificacion}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="form-card">
        <h3>Estado de conexion</h3>
        <div className="mini-list" style={{ marginTop: "1rem" }}>
          <div className="mini-row">
            <span>Fuente</span>
            <strong>Supabase / internos</strong>
          </div>
          <div className="mini-row">
            <span>Registros visibles</span>
            <strong>{internos.length}</strong>
          </div>
          <div className="mini-row">
            <span>Orden</span>
            <strong>Actualizados recientemente</strong>
          </div>
        </div>
      </article>
    </section>
  );
}

