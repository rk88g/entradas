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
  const [createState, createAction, createPending] = useActionState(createDateAction, mutationInitialState);
  const [closeState, closeAction, closePending] = useActionState(closeDateAction, mutationInitialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(updateClosePasswordAction, mutationInitialState);
  const tomorrowValue = getDateOffset(1);
  const waitingValue = getDateOffset(2);
  const canCloseNow = canCloseMexicoCityDate();
  const registeredDates = useMemo(() => [...dates].sort((a, b) => b.fechaCompleta.localeCompare(a.fechaCompleta)), [dates]);
  const tomorrowDate = registeredDates.find((item) => item.fechaCompleta === tomorrowValue) ?? null;
  const waitingDate = registeredDates.find((item) => item.fechaCompleta === waitingValue) ?? null;

  return (
    <section className="module-grid">
      <article className="data-card">
        <strong className="section-title">Fechas</strong>

        <div className="calendar-grid" style={{ marginTop: "1rem" }}>
          {[
            { label: "MAÑANA", dateValue: tomorrowValue, record: tomorrowDate },
            { label: "EN ESPERA", dateValue: waitingValue, record: waitingDate }
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

        <article className="data-card date-section-card">
          <strong className="section-title">Fechas registradas</strong>
          <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
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
                  registeredDates.map((date) => (
                    <tr key={date.id}>
                      <td>{formatLongDate(date.fechaCompleta)}</td>
                      <td>
                        {date.fechaCompleta === tomorrowValue
                          ? "MAÑANA"
                          : date.fechaCompleta === waitingValue
                            ? "EN ESPERA"
                            : "Registrada"}
                      </td>
                      <td>{date.cierre ? "Cerrada" : "Disponible"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </article>

      {roleKey === "super-admin" ? (
        <article className="form-card">
          <article className="data-card date-section-card">
            <strong className="section-title">Crear</strong>
            <MutationBanner state={createState} />
            <form action={createAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
              <div className="field">
                <label htmlFor="fecha_completa">Fecha de visita</label>
                <input id="fecha_completa" name="fecha_completa" type="date" min={tomorrowValue} max={waitingValue} autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="estado">Tipo</label>
                <select id="estado" name="estado" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as "abierto" | "proximo")}>
                  <option value="abierto">MAÑANA</option>
                  <option value="proximo">EN ESPERA</option>
                </select>
              </div>
              <div className="actions-row">
                <LoadingButton pending={createPending} label="Guardar" loadingLabel="Loading..." className="button" />
              </div>
            </form>
          </article>

          <article className="data-card date-section-card">
            <strong className="section-title">Cerrar</strong>
            <p className="muted" style={{ marginTop: "0.4rem" }}>
              {openDate ? `Vas a cerrar la fecha ${formatLongDate(openDate.fechaCompleta)}.` : "No hay fecha registrada para MAÑANA."}
            </p>
            {!canCloseNow ? (
              <p className="muted" style={{ marginTop: "0.4rem" }}>
                Solo puedes cerrar la fecha despues de las 18:00 horas de Mexico.
              </p>
            ) : null}
            <MutationBanner state={closeState} />
            <form action={closeAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
              <input type="hidden" name="fecha_completa" value={openDate?.fechaCompleta ?? ""} />
              <div className="field">
                <label htmlFor="close_password">Contraseña de cierre</label>
                <input id="close_password" name="close_password" type="password" placeholder="Contraseña" autoComplete="off" />
              </div>
              <div className="actions-row">
                <LoadingButton pending={closePending} label="Cerrar fecha" loadingLabel="Loading..." className="button-secondary" disabled={!openDate || !canCloseNow} />
              </div>
            </form>
          </article>

          <article className="data-card date-section-card">
            <strong className="section-title">Contraseña</strong>
            <MutationBanner state={passwordState} />
            <form action={passwordAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
              <div className="field">
                <label htmlFor="new_close_password">
                  {closePasswordConfigured ? "Nueva contraseña de cierre" : "Crear contraseña de cierre"}
                </label>
                <input id="new_close_password" name="close_password" type="password" placeholder="Contraseña" autoComplete="off" />
              </div>
              <div className="actions-row">
                <LoadingButton pending={passwordPending} label="Guardar contraseña" loadingLabel="Loading..." className="button" />
              </div>
            </form>
          </article>
        </article>
      ) : null}
    </section>
  );
}
