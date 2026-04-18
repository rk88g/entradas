import { dashboardStats, fechas, listado } from "@/lib/mock-data";
import { formatLongDate, getStatsFromListings } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

export default function SistemaPage() {
  const stats = getStatsFromListings(listado);
  const nextDate = fechas.find((item) => item.estado === "abierto");

  return (
    <>
      <section className="stats-grid">
        {dashboardStats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <small>{stat.label}</small>
            <strong>{stat.value}</strong>
            <span className="muted" style={{ color: "var(--muted)" }}>
              {stat.hint}
            </span>
          </article>
        ))}
      </section>

      <section className="quick-grid">
        <article className="quick-card">
          <h3>Resumen operativo</h3>
          <div className="mini-list">
            <div className="mini-row">
              <span>Total de pases</span>
              <strong>{stats.totalPasses}</strong>
            </div>
            <div className="mini-row">
              <span>Total de visitantes</span>
              <strong>{stats.totalVisitors}</strong>
            </div>
            <div className="mini-row">
              <span>Menores detectados</span>
              <strong>{stats.minors}</strong>
            </div>
          </div>
        </article>

        <article className="quick-card">
          <h3>Fecha en operación</h3>
          {nextDate ? (
            <>
              <div className="record-title">
                <strong>{formatLongDate(nextDate.fechaCompleta)}</strong>
                <span>Fecha sugerida para captura e impresión</span>
              </div>
              <StatusBadge variant="ok">Abierta</StatusBadge>
            </>
          ) : (
            <StatusBadge variant="off">Sin fecha abierta</StatusBadge>
          )}
        </article>

        <article className="quick-card">
          <h3>Flujo sugerido</h3>
          <div className="mini-list">
            <div className="mini-row">
              <span>1. Registrar interno</span>
              <span className="chip">Base única</span>
            </div>
            <div className="mini-row">
              <span>2. Elegir fecha</span>
              <span className="chip">Día siguiente</span>
            </div>
            <div className="mini-row">
              <span>3. Vincular visitas</span>
              <span className="chip">Sin betadas</span>
            </div>
          </div>
        </article>
      </section>

      <section className="module-grid">
        <article className="module-panel">
          <div className="record-title">
            <strong className="section-title">Qué ya quedó contemplado</strong>
            <span>Diseño responsivo y estructura lista para conectar backend.</span>
          </div>
          <div className="split-grid" style={{ marginTop: "1rem" }}>
            <div className="note-box">
              <strong>Login como inicio</strong>
              <p className="mini-copy">
                La aplicación abre directamente con acceso al sistema y selección de rol.
              </p>
            </div>
            <div className="note-box">
              <strong>Módulos principales</strong>
              <p className="mini-copy">
                Interno, Visitas, Listado y Fechas, con foco en operación diaria.
              </p>
            </div>
            <div className="note-box">
              <strong>Pases 618 e INTIMA</strong>
              <p className="mini-copy">
                Separados por apartado, con agrupación por interno y menciones en sueltos.
              </p>
            </div>
            <div className="note-box">
              <strong>Alertas visuales</strong>
              <p className="mini-copy">
                Menores de 12 resaltados en rojo y visitas betadas bloqueadas visualmente.
              </p>
            </div>
          </div>
        </article>

        <article className="form-card">
          <h3>Próximo paso al conectar Supabase</h3>
          <div className="mini-list" style={{ marginTop: "1rem" }}>
            <div className="mini-row">
              <span>Autenticación</span>
              <strong>Supabase Auth + perfiles</strong>
            </div>
            <div className="mini-row">
              <span>Permisos</span>
              <strong>RLS por rol operativo</strong>
            </div>
            <div className="mini-row">
              <span>Despliegue</span>
              <strong>Vercel con variables de entorno</strong>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

