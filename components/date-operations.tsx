"use client";

import { useActionState, useState } from "react";
import { closeDateAction, createDateAction, updateClosePasswordAction } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord, MutationState, RoleKey } from "@/lib/types";
import { formatLongDate, getDateOffset, getStatusDisplayLabel } from "@/lib/utils";

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
  const activeDates = dates.filter((date) => date.estado === "abierto" || date.estado === "proximo");

  return (
    <section className="module-grid">
      <article className="data-card">
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
        >
          <strong className="section-title">Fechas</strong>
        </div>

        <div className="stack" style={{ marginTop: "1rem", gap: "1rem" }}>
          <div className="data-card" style={{ padding: "1rem" }}>
            <strong className="section-title">Fechas registradas</strong>
            <p className="muted" style={{ marginTop: "0.4rem" }}>
              PROXIMOS corresponde a manana y EN ESPERA a dos dias adelante.
            </p>
          </div>
          <div className="calendar-grid">
          {activeDates.map((date) => (
            <article key={date.id} className="calendar-card">
              <div className="record-title">
                <strong>{formatLongDate(date.fechaCompleta)}</strong>
              </div>
              <div className="chips-row">
                <span className="chip">{getStatusDisplayLabel(date.estado)}</span>
                <span className="chip">{date.cierre ? "Cerrada" : "Disponible"}</span>
              </div>
            </article>
          ))}
          </div>
        </div>
      </article>

      <article className="form-card">
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
              <option value="abierto">PROXIMOS</option>
              <option value="proximo">EN ESPERA</option>
            </select>
          </div>
          <div className="actions-row">
            <button type="submit" className="button" disabled={createPending}>
              Guardar
            </button>
          </div>
        </form>

        {roleKey === "super-admin" ? (
          <>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.5rem 0" }} />
            <strong className="section-title">Cerrar fecha</strong>
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
                <button
                  className="button-secondary"
                  type="submit"
                  disabled={closePending || !openDate}
                >
                  Cerrar PROXIMOS
                </button>
              </div>
            </form>
          </>
        ) : null}

        {roleKey === "super-admin" ? (
          <>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.5rem 0" }} />
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
                <button type="submit" className="button" disabled={passwordPending}>
                  Guardar contrasena
                </button>
              </div>
            </form>
          </>
        ) : null}
      </article>
    </section>
  );
}
