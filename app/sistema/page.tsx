import { getDashboardSummary, getInternos, getVisitas } from "@/lib/supabase/queries";

export default async function SistemaPage() {
  const [summary, internos, visitas] = await Promise.all([
    getDashboardSummary(),
    getInternos(),
    getVisitas()
  ]);

  return (
    <section className="stats-grid">
      <article className="stat-card">
        <small>Internos</small>
        <strong>{internos.length}</strong>
      </article>
      <article className="stat-card">
        <small>Visitas</small>
        <strong>{visitas.length}</strong>
      </article>
      <article className="stat-card">
        <small>Proximos</small>
        <strong>{summary.openPassCount}</strong>
      </article>
      <article className="stat-card">
        <small>En espera</small>
        <strong>{summary.waitingPassCount}</strong>
      </article>
    </section>
  );
}
