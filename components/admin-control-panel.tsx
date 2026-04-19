"use client";

import { useActionState, useState } from "react";
import { updateAuthUserPasswordAction } from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { ActionAuditRecord, ConnectionLogRecord, MutationState } from "@/lib/types";
import { formatLongDate } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatLongDate(value.slice(0, 10))} ${date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function AdminControlPanel({
  connectionLogs,
  actionLogs,
  users,
  adminConfigured
}: {
  connectionLogs: ConnectionLogRecord[];
  actionLogs: ActionAuditRecord[];
  users: Array<{ id: string; fullName: string; roleKey: string }>;
  adminConfigured: boolean;
}) {
  const [tab, setTab] = useState<"sesiones" | "acciones" | "usuarios">("sesiones");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updateAuthUserPasswordAction,
    mutationInitialState
  );

  return (
    <section className="module-panel">
      <div className="toolbar">
        <button
          type="button"
          className={`button-secondary listing-toggle ${tab === "sesiones" ? "active" : ""}`}
          onClick={() => setTab("sesiones")}
        >
          Sesiones
        </button>
        <button
          type="button"
          className={`button-secondary listing-toggle ${tab === "acciones" ? "active" : ""}`}
          onClick={() => setTab("acciones")}
        >
          Acciones
        </button>
        <button
          type="button"
          className={`button-secondary listing-toggle ${tab === "usuarios" ? "active" : ""}`}
          onClick={() => setTab("usuarios")}
        >
          Usuarios
        </button>
      </div>

      {tab === "sesiones" ? (
        <article className="data-card" style={{ marginTop: "1rem" }}>
          <strong className="section-title">Logs de conexion</strong>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Resultado</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {connectionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin logs de conexion.</td>
                  </tr>
                ) : (
                  connectionLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>{log.userName ?? "-"}</td>
                      <td>{log.email}</td>
                      <td>{log.success ? "Correcto" : log.failureReason ?? "Fallido"}</td>
                      <td>{log.ipAddress ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {tab === "acciones" ? (
        <article className="data-card" style={{ marginTop: "1rem" }}>
          <strong className="section-title">Logs de acciones</strong>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Modulo</th>
                  <th>Seccion</th>
                  <th>Accion</th>
                  <th>Elemento</th>
                  <th>Antes</th>
                  <th>Despues</th>
                </tr>
              </thead>
              <tbody>
                {actionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Sin logs de acciones.</td>
                  </tr>
                ) : (
                  actionLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>{log.userName ?? "-"}</td>
                      <td>{log.moduleKey}</td>
                      <td>{log.sectionKey}</td>
                      <td>{log.actionKey}</td>
                      <td>{`${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}`}</td>
                      <td>
                        <pre className="audit-pre">{log.beforeData ?? "-"}</pre>
                      </td>
                      <td>
                        <pre className="audit-pre">{log.afterData ?? "-"}</pre>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {tab === "usuarios" ? (
        <article className="form-card" style={{ marginTop: "1rem" }}>
          <strong className="section-title">Cambiar contrasena</strong>
          {!adminConfigured ? (
            <div className="alert-box" style={{ marginTop: "1rem" }}>
              Falta configurar `SUPABASE_SERVICE_ROLE_KEY` para poder cambiar contrasenas.
            </div>
          ) : null}
          <MutationBanner state={passwordState} />
          <form action={passwordAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
            <div className="field">
              <select name="user_id" defaultValue="" required>
                <option value="" disabled>
                  Usuario
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} - {user.roleKey}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <input name="password" type="password" placeholder="Nueva contrasena" autoComplete="off" />
            </div>
            <div className="actions-row">
              <LoadingButton
                pending={passwordPending}
                label="Actualizar contrasena"
                loadingLabel="Loading..."
                className="button"
                disabled={!adminConfigured}
              />
            </div>
          </form>
        </article>
      ) : null}
    </section>
  );
}
