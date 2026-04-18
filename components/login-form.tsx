"use client";

import Link from "next/link";
import { roles } from "@/lib/mock-data";

export function LoginForm() {
  return (
    <form className="login-form stack">
      <div className="stack">
        <span className="eyebrow" style={{ color: "#0f766e", background: "#d9f2ef" }}>
          Inicio del sistema
        </span>
        <h2>Acceso seguro para captura y control de pases</h2>
        <p className="muted" style={{ color: "var(--muted)" }}>
          La vista inicial ya está pensada como login y prioriza rapidez de captura. Después
          del acceso, el usuario aterriza en el tablero con los pases del día siguiente.
        </p>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="usuario">Usuario</label>
          <input id="usuario" name="usuario" placeholder="capturador.01" />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" placeholder="••••••••" />
        </div>
        <div className="field">
          <label htmlFor="rol">Rol</label>
          <select id="rol" defaultValue="capturador">
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <span className="field-hint" style={{ color: "var(--muted)" }}>
            Roles contemplados: super-admin, control, supervisor y capturador.
          </span>
        </div>
      </div>

      <div className="actions-row">
        <Link href="/sistema" className="button button-full">
          Entrar al sistema
        </Link>
      </div>

      <div className="split-grid">
        <div className="note-box">
          <strong>Captura rápida</strong>
          <p className="mini-copy">
            Registro de interno, selección de fecha y anexado de visitantes en un flujo corto.
          </p>
        </div>
        <div className="alert-box">
          <strong>Validación automática</strong>
          <p className="mini-copy">
            Si una visita está betada, el sistema la bloquea desde la captura.
          </p>
        </div>
      </div>
    </form>
  );
}

