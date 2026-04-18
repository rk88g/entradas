import { LoginForm } from "@/components/login-form";

export default function HomePage() {
  return (
    <main className="page-bg">
      <div className="page-shell login-grid">
        <section className="login-hero glass-panel">
          <div className="stack">
            <span className="eyebrow">Sistema de ingreso institucional</span>
            <h1 className="hero-title">Captura, control y listado de pases sin fricción</h1>
            <p className="hero-copy">
              Esta base ya contempla login como pantalla inicial, roles operativos, módulos para
              interno, visitas, fechas y listado, además de una vista de impresión pensada para
              hoja oficio y agrupación por interno.
            </p>
          </div>

          <div className="hero-metrics">
            <div className="metric">
              <strong>618</strong>
              <span>Pases agrupados por día</span>
            </div>
            <div className="metric">
              <strong>INTIMA</strong>
              <span>Pases sueltos con mención</span>
            </div>
            <div className="metric">
              <strong>Rápido</strong>
              <span>Captura lista para Supabase</span>
            </div>
          </div>
        </section>

        <section className="login-card glass-panel">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}

