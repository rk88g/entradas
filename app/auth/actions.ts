"use server";

import { redirect } from "next/navigation";
import { logConnectionEvent } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error: string | null;
}

async function resolveAuthEmail(rawUsername: string) {
  if (rawUsername.includes("@")) {
    return rawUsername;
  }

  const normalizedUsername = rawUsername.trim().toLowerCase();
  const defaultEmail = `${normalizedUsername}@intranetprev.com`;

  if (!isSupabaseAdminConfigured()) {
    return defaultEmail;
  }

  try {
    const admin = createSupabaseAdminClient();
    let page = 1;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200
      });

      if (error) {
        break;
      }

      const users = data?.users ?? [];
      if (users.length === 0) {
        break;
      }

      const exactEmail = users.find((user) => (user.email ?? "").toLowerCase() === defaultEmail);
      if (exactEmail?.email) {
        return exactEmail.email;
      }

      const sameLocalPart = users.find((user) => {
        const email = (user.email ?? "").toLowerCase();
        const [localPart] = email.split("@");
        return localPart === normalizedUsername;
      });

      if (sameLocalPart?.email) {
        return sameLocalPart.email;
      }

      if (users.length < 200) {
        break;
      }

      page += 1;
    }
  } catch {
    return defaultEmail;
  }

  return defaultEmail;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawUsername = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fallbackEmail = rawUsername.includes("@")
    ? rawUsername
    : `${rawUsername.toLowerCase()}@intranetprev.com`;

  if (!rawUsername || !password) {
    return { error: "Escribe tu usuario y tu contrasena." };
  }

  try {
    const email = await resolveAuthEmail(rawUsername);
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
      email: fallbackEmail,
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
