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
        <small>618</small>
        <strong>{summary.listingStats.areas["618"] ?? 0}</strong>
      </article>
      <article className="stat-card">
        <small>Sueltos</small>
        <strong>{summary.listingStats.areas.INTIMA ?? 0}</strong>
      </article>
    </section>
  );
}
