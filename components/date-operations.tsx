"use client";

import { useActionState, useState } from "react";
import { closeDateAction, createDateAction, updateClosePasswordAction } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord, MutationState, RoleKey } from "@/lib/types";
import { formatLongDate, getDateOffset } from "@/lib/utils";

const statusLabels = {
  abierto: "Pases sueltos",
  proximo: "Fecha 618",
  cerrado: "Fecha cerrada"
} as const;

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

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong className="section-title">Fechas</strong>
        </div>

        <div className="mini-list" style={{ marginBottom: "1rem" }}>
          <div className="mini-row">
            <span>Proximo</span>
            <strong>Fecha de visita para la oficina 618</strong>
          </div>
          <div className="mini-row">
            <span>Abierto</span>
            <strong>Fecha de visita para pases sueltos</strong>
          </div>
          <div className="mini-row">
            <span>Cerrado</span>
            <strong>Fecha 618 ya numerada y cerrada</strong>
          </div>
        </div>

        <div className="calendar-grid" style={{ marginTop: "1rem" }}>
          {dates.map((date) => (
            <article key={date.id} className="calendar-card">
              <div className="record-title">
                <strong>{formatLongDate(date.fechaCompleta)}</strong>
              </div>
              <div className="chips-row">
                <span className="chip">{statusLabels[date.estado]}</span>
                <span className="chip">{date.cierre ? "Cerrada" : "Abierta"}</span>
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="form-card">
        <strong className="section-title">Nueva fecha</strong>
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
            <label htmlFor="estado">Uso de la fecha</label>
            <select
              id="estado"
              name="estado"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as "abierto" | "proximo")}
            >
              <option value="abierto">Abierto</option>
              <option value="proximo">Proximo</option>
            </select>
          </div>
          <div className="actions-row">
            <button type="submit" className="button" disabled={createPending}>
              Guardar
            </button>
          </div>
        </form>

        {roleKey === "super-admin" || roleKey === "control" ? (
          <>
            <div style={{ height: "1rem" }} />
            <strong className="section-title">Cierre</strong>
            <MutationBanner state={closeState} />
            {!nextDate ? (
              <MutationBanner
                state={{ success: null, error: "No hay fecha proximo para cerrar." }}
              />
            ) : null}
            <form
              action={closeAction}
              className="field-grid"
              style={{ marginTop: "1rem" }}
              autoComplete="off"
            >
              <input type="hidden" name="fecha_completa" value={nextDate?.fechaCompleta ?? ""} />
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
                  disabled={closePending || !nextDate}
                >
                  Cerrar fecha 618
                </button>
              </div>
            </form>
          </>
        ) : null}

        {roleKey === "super-admin" ? (
          <>
            <div style={{ height: "1rem" }} />
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
