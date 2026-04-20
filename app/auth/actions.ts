"use server";

import { redirect } from "next/navigation";
import { logConnectionEvent } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error: string | null;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawUsername = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const email = rawUsername.includes("@")
    ? rawUsername
    : `${rawUsername}@intranetprev.com`;

  if (!rawUsername || !password) {
    return { error: "Escribe tu usuario y tu contrasena." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      await logConnectionEvent({
        email,
        success: false,
        failureReason: error.message
      });
      return { error: "No se pudo iniciar sesion. Revisa usuario, contrasena y permisos." };
    }

    await logConnectionEvent({
      userId: data.user?.id ?? null,
      email,
      success: true
    });
  } catch {
    await logConnectionEvent({
      email,
      success: false,
      failureReason: "No se pudo conectar con Supabase."
    });
    return { error: "No se pudo conectar con Supabase. Revisa tus variables de entorno." };
  }

  redirect("/sistema");
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}
