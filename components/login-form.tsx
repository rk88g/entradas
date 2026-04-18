"use client";

import { useActionState } from "react";
import { signInAction, type AuthActionState } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const initialState: AuthActionState = {
  error: null
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  return (
    <button type="submit" className="button button-full" disabled={disabled}>
      Entrar
    </button>
  );
}

export function LoginForm({
  configured,
  initialError
}: {
  configured: boolean;
  initialError?: string | null;
}) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  const disabled = pending || !configured || !isSupabaseConfigured();

  return (
    <form action={formAction} className="login-form stack" autoComplete="off">
      {initialError ? (
        <div className="alert-box">
          <p className="mini-copy">{initialError}</p>
        </div>
      ) : null}

      {state.error ? (
        <div className="alert-box">
          <p className="mini-copy">{state.error}</p>
        </div>
      ) : null}

      {!configured ? (
        <div className="alert-box">
          <p className="mini-copy">Falta configurar Supabase en las variables de entorno.</p>
        </div>
      ) : null}

      <div className="field-grid">
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="usuario@institucion.mx"
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="off"
            placeholder="********"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="actions-row">
        <SubmitButton disabled={disabled} />
      </div>
    </form>
  );
}
