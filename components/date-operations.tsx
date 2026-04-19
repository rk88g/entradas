"use client";

import { useActionState, useMemo, useState } from "react";
import { closeDateAction, createDateAction, updateClosePasswordAction } from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord, MutationState, RoleKey } from "@/lib/types";
import { canCloseMexicoCityDate, formatLongDate, getDateOffset } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

export function DateOperations({
  dates,
  nextDate,
  openDate,
  roleKey,
  closePasswordConfigured
}: {
  dates: DateRecord[];
  nextDate: DateRecord | null;
  openDate: DateRecord | null;
  roleKey: RoleKey;
  closePasswordConfigured: boolean;
}) {
  const [selectedStatus, setSelectedStatus] = useState<"abierto" | "proximo">("abierto");
  const [createState, createAction, createPending] = useActionState(
    createDateAction,
    mutationInitialState
  );
  const [closeState, closeAction, closePending] = useActionState(closeDateAction, mutationInitialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updateClosePasswordAction,
    mutationInitialState
  );
  const tomorrowValue = getDateOffset(1);
  const waitingValue = getDateOffset(2);
  const canCloseNow = canCloseMexicoCityDate();
  const registeredDates = useMemo(
    () => [...dates].sort((a, b) => b.fechaCompleta.localeCompare(a.fechaCompleta)),
    [dates]
  );
  const tomorrowDate = registeredDates.find((item) => item.fechaCompleta === tomorrowValue) ?? null;
  const waitingDate = registeredDates.find((item) => item.fechaCompleta === waitingValue) ?? null;

  return (
    <section className="module-grid">
      <article className="data-card">
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
        >
          <strong className="section-title">Fechas</strong>
        </div>

        <div className="stack" style={{ marginTop: "1rem", gap: "1.25rem" }}>
          <div
            className="data-card"
            style={{
              padding: "1.15rem",
              border: "2px solid var(--line-strong)",
              background: "color-mix(in srgb, var(--panel) 88%, var(--brand-2) 12%)"
            }}
          >
            <strong className="section-title">Fechas operativas</strong>
          </div>
          <div className="calendar-grid">
            {[
              { label: "MAÑANA", dateValue: tomorrowValue, record: tomorrowDate },
              { label: "EN ESPERA", dateValue: waitingValue, record: waitingDate }
            ].map((slot) => (
            <article key={slot.dateValue} className="calendar-card">
              <div className="record-title">
                <strong>{formatLongDate(slot.dateValue)}</strong>
              </div>
              <div className="chips-row">
                <span className="chip">{slot.label}</span>
                <span className="chip">
                  {slot.record ? (slot.record.cierre ? "Cerrada" : "Registrada") : "Sin registrar"}
                </span>
              </div>
            </article>
          ))}
          </div>

          <div
            className="data-card"
            style={{
              padding: "1.15rem",
              border: "2px solid var(--line-strong)",
              background: "color-mix(in srgb, var(--panel) 92%, var(--brand) 8%)"
            }}
          >
            <strong className="section-title">Fechas registradas</strong>
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Apartado</th>
                    <th>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredDates.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Sin fechas registradas.</td>
                    </tr>
                  ) : (
                    registeredDates.map((date) => (
                      <tr key={date.id}>
                        <td>{formatLongDate(date.fechaCompleta)}</td>
                        <td>{date.fechaCompleta === tomorrowValue ? "MAÑANA" : date.fechaCompleta === waitingValue ? "EN ESPERA" : "Registrada"}</td>
                        <td>{date.cierre ? "Cerrada" : "Disponible"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </article>

      <article className="form-card">
        <div className="data-card" style={{ padding: "1.15rem", border: "2px solid var(--line-strong)" }}>
          <strong className="section-title">Crear fecha</strong>
          <MutationBanner state={createState} />
          <form
            action={createAction}
            className="field-grid"
            style={{ marginTop: "1rem" }}
            autoComplete="off"
          >
            <div className="field">
              <label htmlFor="fecha_completa">Fecha de visita</label>
              <input
                id="fecha_completa"
                name="fecha_completa"
                type="date"
                min={getDateOffset(1)}
                max={getDateOffset(2)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="estado">Apartado</label>
              <select
                id="estado"
                name="estado"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as "abierto" | "proximo")}
              >
                <option value="abierto">MAÑANA</option>
                <option value="proximo">EN ESPERA</option>
              </select>
            </div>
            <div className="actions-row">
              <LoadingButton pending={createPending} label="Guardar" loadingLabel="Loading..." className="button" />
            </div>
          </form>
        </div>

        {roleKey === "super-admin" ? (
          <>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.5rem 0" }} />
            <div className="data-card" style={{ padding: "1.15rem", border: "2px solid var(--line-strong)" }}>
              <strong className="section-title">Cerrar fecha</strong>
              <p className="muted" style={{ marginTop: "0.45rem" }}>
                {openDate
                  ? `Estas por cerrar la fecha de ${formatLongDate(openDate.fechaCompleta)}.`
                  : "No hay fecha activa en PROXIMOS para cerrar."}
              </p>
              {!canCloseNow ? (
                <p className="muted" style={{ marginTop: "0.45rem" }}>
                  Solo puedes cerrar la fecha despues de las 18:00 horas de Mexico.
                </p>
              ) : null}
              <MutationBanner state={closeState} />
              {!openDate ? (
                <MutationBanner
                  state={{ success: null, error: "No hay fecha activa en PROXIMOS para cerrar." }}
                />
              ) : null}
              <form
                action={closeAction}
                className="field-grid"
                style={{ marginTop: "1rem" }}
                autoComplete="off"
              >
                <input type="hidden" name="fecha_completa" value={openDate?.fechaCompleta ?? ""} />
                <div className="field">
                  <label htmlFor="close_password">Contrasena de cierre</label>
                  <input
                    id="close_password"
                    name="close_password"
                    type="password"
                    placeholder="Contrasena"
                    autoComplete="off"
                  />
                </div>
                <div className="actions-row">
                  <LoadingButton
                    pending={closePending}
                    label={`Cerrar ${openDate ? formatLongDate(openDate.fechaCompleta) : "MAÑANA"}`}
                    loadingLabel="Loading..."
                    className="button-secondary"
                    disabled={!openDate || !canCloseNow}
                  />
                </div>
              </form>
            </div>
          </>
        ) : null}

        {roleKey === "super-admin" ? (
          <>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.5rem 0" }} />
            <div className="data-card" style={{ padding: "1.15rem", border: "2px solid var(--line-strong)" }}>
              <strong className="section-title">Contrasena</strong>
              <MutationBanner state={passwordState} />
              <form
                action={passwordAction}
                className="field-grid"
                style={{ marginTop: "1rem" }}
                autoComplete="off"
              >
                <div className="field">
                  <label htmlFor="new_close_password">
                    {closePasswordConfigured ? "Nueva contrasena de cierre" : "Crear contrasena de cierre"}
                  </label>
                  <input
                    id="new_close_password"
                    name="close_password"
                    type="password"
                    placeholder="Contrasena"
                    autoComplete="off"
                  />
                </div>
                <div className="actions-row">
                  <LoadingButton
                    pending={passwordPending}
                    label="Guardar contrasena"
                    loadingLabel="Loading..."
                    className="button"
                  />
                </div>
              </form>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
