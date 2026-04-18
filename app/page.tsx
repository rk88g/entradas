import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

function getInitialError(code?: string) {
  if (code === "auth") {
    return "Tu sesion termino o aun no has iniciado sesion.";
  }

  if (code === "profile") {
    return "Tu usuario no tiene perfil activo o rol asignado en user_profiles.";
  }

  return null;
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (configured) {
    const profile = await getCurrentUserProfile();
    if (profile?.active) {
      redirect("/sistema");
    }
  }

  return (
    <main className="page-bg">
      <div
        className="page-shell"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
      >
        <section className="login-card glass-panel" style={{ width: "min(100%, 460px)" }}>
          <LoginForm
            configured={configured}
            initialError={getInitialError(resolvedSearchParams?.error)}
          />
        </section>
      </div>
    </main>
  );
}

