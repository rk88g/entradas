import { redirect } from "next/navigation";
import { getCurrentUserProfile, getDashboardSummary, getInternos, getVisitas } from "@/lib/supabase/queries";

export default async function SistemaPage() {
  const [profile, summary, internos, visitas] = await Promise.all([
    getCurrentUserProfile(),
    getDashboardSummary(),
    getInternos(),
    getVisitas()
  ]);

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

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
