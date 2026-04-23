"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { closeDateAction, createDateAction, updateClosePasswordAction } from "@/app/sistema/actions";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord, MutationState, RoleKey } from "@/lib/types";
import { formatLongDate, getDateOffset } from "@/lib/utils";

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
  const [createState, createAction, createPending] = useActionState(createDateAction, mutationInitialState);
  const [closeState, closeAction, closePending] = useActionState(closeDateAction, mutationInitialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(updateClosePasswordAction, mutationInitialState);
  const [screenLoading, setScreenLoading] = useState(false);
  const tomorrowValue = getDateOffset(1);
  const waitingValue = getDateOffset(2);
  const registeredDates = useMemo(() => [...dates].sort((a, b) => b.fechaCompleta.localeCompare(a.fechaCompleta)), [dates]);
  const closableDates = useMemo(() => registeredDates.filter((item) => !item.cierre), [registeredDates]);
  const tomorrowDate = registeredDates.find((item) => item.fechaCompleta === tomorrowValue) ?? null;
  const waitingDate = registeredDates.find((item) => item.fechaCompleta === waitingValue) ?? null;

  useEffect(() => {
    if (!createPending && !closePending && !passwordPending) {
      setScreenLoading(false);
    }
  }, [createPending, closePending, passwordPending]);

  return (
    <section className="module-grid module-grid-single">
      <FullscreenLoading active={screenLoading || createPending || closePending || passwordPending} />
      <article className="data-card">
        <strong className="section-title">Fechas</strong>

        <div className="calendar-grid" style={{ marginTop: "1rem" }}>
          {[
            { label: "EN ESPERA", dateValue: waitingValue, record: waitingDate },
            { label: "MANANA", dateValue: tomorrowValue, record: tomorrowDate }
          ].map((slot) => (
            <article key={slot.dateValue} className="calendar-card date-slot-card">
              <span className="eyebrow">{slot.label}</span>
              <div className="record-title" style={{ marginTop: "0.55rem" }}>
                <strong>{formatLongDate(slot.dateValue)}</strong>
              </div>
              <div className="chips-row" style={{ marginTop: "0.7rem" }}>
                <span className="chip">{slot.record ? (slot.record.cierre ? "Cerrada" : "Registrada") : "Sin fecha"}</span>
              </div>
            </article>
          ))}
        </div>

        <details className="data-card section-collapse date-section-card">
          <summary>
            <span>Fechas registradas</span>
            <span>{registeredDates.length} registros</span>
          </summary>
          <div className="section-collapse-body">
            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredDates.length === 0 ? (
                    <tr><td colSpan={3}>Sin fechas registradas.</td></tr>
                  ) : (
                    registeredDates.map((date) => {
                      const concluded = date.fechaCompleta < tomorrowValue;
                      const type = concluded
                        ? "CONCLUIDA"
                        : date.fechaCompleta === tomorrowValue
                          ? "MANANA"
                          : date.fechaCompleta === waitingValue
                            ? "EN ESPERA"
                            : "Registrada";
                      const status = concluded ? "CONCLUIDA" : date.cierre ? "Cerrada" : "Disponible";

                      return (
                        <tr key={date.id}>
                          <td>{formatLongDate(date.fechaCompleta)}</td>
                          <td>{type}</td>
                          <td>{status}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </article>

      {roleKey === "super-admin" ? (
        <article className="form-card collapse-stack">
          <details className="data-card section-collapse date-section-card">
            <summary>
              <span>Crear</span>
              <span>Fecha nueva</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={createState} />
              <form action={createAction} className="field-grid" autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
                <div className="field">
                  <label htmlFor="fecha_completa">Fecha de visita</label>
                  <input id="fecha_completa" name="fecha_completa" type="date" min={tomorrowValue} autoComplete="off" />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={createPending} label="Guardar" loadingLabel="Loading..." className="button" />
                </div>
              </form>
            </div>
          </details>

          <details className="data-card section-collapse date-section-card">
            <summary>
              <span>Cerrar</span>
              <span>{closableDates[0] ? formatLongDate(closableDates[0].fechaCompleta) : "Sin fecha"}</span>
            </summary>
            <div className="section-collapse-body">
              <p className="muted">
                {closableDates[0]
                  ? "Elige cualquier fecha disponible para cerrarla y enumerar sus pases."
                  : "No hay fechas disponibles para cerrar."}
              </p>
              <MutationBanner state={closeState} />
              <form action={closeAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
                <div className="field">
                  <label htmlFor="close_date_value">Fecha a cerrar</label>
                  <select id="close_date_value" name="fecha_completa" defaultValue={closableDates[0]?.fechaCompleta ?? ""}>
                    {closableDates.length === 0 ? <option value="">Sin fechas disponibles</option> : null}
                    {closableDates.map((date) => (
                      <option key={date.id} value={date.fechaCompleta}>
                        {formatLongDate(date.fechaCompleta)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="close_password">Contrasena de cierre</label>
                  <input id="close_password" name="close_password" type="password" placeholder="Contrasena" autoComplete="off" />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={closePending} label="Cerrar fecha" loadingLabel="Loading..." className="button-secondary" disabled={closableDates.length === 0} />
                </div>
              </form>
            </div>
          </details>

          <details className="data-card section-collapse date-section-card">
            <summary>
              <span>Contrasena</span>
              <span>{closePasswordConfigured ? "Actualizable" : "Sin definir"}</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={passwordState} />
              <form action={passwordAction} className="field-grid" autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
                <div className="field">
                  <label htmlFor="new_close_password">
                    {closePasswordConfigured ? "Nueva contrasena de cierre" : "Crear contrasena de cierre"}
                  </label>
                  <input id="new_close_password" name="close_password" type="password" placeholder="Contrasena" autoComplete="off" />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={passwordPending} label="Guardar contrasena" loadingLabel="Loading..." className="button" />
                </div>
              </form>
            </div>
          </details>
        </article>
      ) : null}
    </section>
  );
}
