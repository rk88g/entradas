import { StatusBadge } from "@/components/status-badge";
import { getDashboardSummary } from "@/lib/supabase/queries";
import { formatLongDate } from "@/lib/utils";

export default async function SistemaPage() {
  const summary = await getDashboardSummary();

  return (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <small>Pases manana</small>
          <strong>{summary.totalTomorrowPasses}</strong>
          <span className="muted" style={{ color: "var(--muted)" }}>
            Registros reales para {summary.tomorrowDate}
          </span>
        </article>
        <article className="stat-card">
          <small>Visitas activas</small>
          <strong>{summary.activeVisitors}</strong>
          <span className="muted" style={{ color: "var(--muted)" }}>
            Lectura directa desde la tabla visitas
          </span>
        </article>
        <article className="stat-card">
          <small>Betadas activas</small>
          <strong>{summary.totalBetadas}</strong>
          <span className="muted" style={{ color: "var(--muted)" }}>
            Tomadas desde la tabla betadas
          </span>
        </article>
      </section>

      <section className="quick-grid">
        <article className="quick-card">
          <h3>Resumen operativo</h3>
          <div className="mini-list">
            <div className="mini-row">
              <span>Total de pases</span>
              <strong>{summary.listingStats.totalPasses}</strong>
            </div>
            <div className="mini-row">
              <span>Total de visitantes</span>
              <strong>{summary.listingStats.totalVisitors}</strong>
            </div>
            <div className="mini-row">
              <span>Menores detectados</span>
              <strong>{summary.listingStats.minors}</strong>
            </div>
          </div>
        </article>

        <article className="quick-card">
          <h3>Fecha en operacion</h3>
          {summary.nextOpenDate ? (
            <>
              <div className="record-title">
                <strong>{formatLongDate(summary.nextOpenDate.fechaCompleta)}</strong>
                <span>Leida desde la tabla fechas</span>
              </div>
              <StatusBadge variant="ok">Abierta</StatusBadge>
            </>
          ) : (
            <StatusBadge variant="off">Sin fecha abierta</StatusBadge>
          )}
        </article>

        <article className="quick-card">
          <h3>Lecturas activas</h3>
          <div className="mini-list">
            <div className="mini-row">
              <span>internos</span>
              <span className="chip">Conectado</span>
            </div>
            <div className="mini-row">
              <span>visitas y betadas</span>
              <span className="chip">Conectado</span>
            </div>
            <div className="mini-row">
              <span>fechas y listado</span>
              <span className="chip">Conectado</span>
            </div>
          </div>
        </article>
      </section>

      <section className="module-grid">
        <article className="module-panel">
          <div className="record-title">
            <strong className="section-title">Conexion real lista</strong>
            <span>
              La sesion ya sale de Supabase Auth y el panel lee las tablas con la sesion del
              usuario autenticado.
            </span>
          </div>
          <div className="split-grid" style={{ marginTop: "1rem" }}>
            <div className="note-box">
              <strong>Auth real</strong>
              <p className="mini-copy">Correo y contrasena contra Supabase Auth.</p>
            </div>
            <div className="note-box">
              <strong>Roles reales</strong>
              <p className="mini-copy">El rol viene de user_profiles y roles.</p>
            </div>
            <div className="note-box">
              <strong>Lectura protegida</strong>
              <p className="mini-copy">Las rutas del sistema requieren sesion activa.</p>
            </div>
            <div className="note-box">
              <strong>Listado operativo</strong>
              <p className="mini-copy">Pases e historial se construyen desde listado y listado_visitas.</p>
            </div>
          </div>
        </article>

        <article className="form-card">
          <h3>Lo que ya debes ver con tu base</h3>
          <div className="mini-list" style={{ marginTop: "1rem" }}>
            <div className="mini-row">
              <span>Usuarios</span>
              <strong>Sesion persistente</strong>
            </div>
            <div className="mini-row">
              <span>Permisos</span>
              <strong>RLS segun tu perfil</strong>
            </div>
            <div className="mini-row">
              <span>Datos</span>
              <strong>Tablas reales en pantalla</strong>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

