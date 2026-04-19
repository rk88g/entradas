import { redirect } from "next/navigation";
import {
  getCurrentUserProfile,
  getDashboardSummary,
  getIntegratedModuleCounts,
  getInternos,
  getVisitas
} from "@/lib/supabase/queries";

export default async function SistemaPage() {
  const [profile, summary, internos, visitas, moduleCounts] = await Promise.all([
    getCurrentUserProfile(),
    getDashboardSummary(),
    getInternos(),
    getVisitas(),
    getIntegratedModuleCounts()
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
        <small>Mañana</small>
        <strong>{summary.openPassCount}</strong>
      </article>
      <article className="stat-card">
        <small>618</small>
        <strong>{summary.waitingPassCount}</strong>
      </article>
      <article className="stat-card">
        <small>Visual</small>
        <strong>{moduleCounts.visual}</strong>
      </article>
      <article className="stat-card">
        <small>Comunicacion</small>
        <strong>{moduleCounts.comunicacion}</strong>
      </article>
    </section>
  );
}
