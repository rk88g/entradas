import { redirect } from "next/navigation";
import {
  getCurrentUserProfile,
  getDashboardSummary,
  getEscalerasPanelData,
  getIntegratedModuleCounts,
  getInternos,
  getVisitas
} from "@/lib/supabase/queries";
import { canAccessCoreSystem } from "@/lib/utils";

export default async function SistemaPage() {
  const [profile, summary, internos, visitas, moduleCounts, escaleras] = await Promise.all([
    getCurrentUserProfile(),
    getDashboardSummary(),
    getInternos(),
    getVisitas(),
    getIntegratedModuleCounts(),
    getEscalerasPanelData()
  ]);

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  if (profile && !canAccessCoreSystem(profile.roleKey, profile.moduleOnly)) {
    redirect("/sistema/escaleras");
  }

  const canSeeCore = canAccessCoreSystem(profile?.roleKey ?? "capturador", profile?.moduleOnly ?? false);
  const visibleStats = [
    ...(profile?.roleKey === "super-admin" || canSeeCore
      ? [
          { label: "Internos", value: internos.length },
          { label: "Visitas", value: visitas.length },
          { label: "Mañana", value: summary.openPassCount },
          { label: "En espera", value: summary.waitingPassCount }
        ]
      : []),
    ...(profile?.roleKey === "super-admin" ||
    profile?.accessibleModules.some((item) => item.moduleKey === "visual")
      ? [{ label: "Visual", value: moduleCounts.visual }]
      : []),
    ...(profile?.roleKey === "super-admin" ||
    profile?.accessibleModules.some((item) => item.moduleKey === "comunicacion")
      ? [{ label: "Comunicacion", value: moduleCounts.comunicacion }]
      : []),
    ...(profile?.roleKey === "super-admin" ||
    profile?.accessibleModules.some((item) => item.moduleKey === "escaleras")
      ? [{ label: "Escaleras", value: escaleras.length }]
      : [])
  ];

  return (
    <section className="stats-grid">
      {visibleStats.map((item) => (
        <article key={item.label} className="stat-card">
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}
