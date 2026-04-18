"use client";

import { useActionState } from "react";
import { closeDateAction, createDateAction, mutationInitialState } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord } from "@/lib/types";
import { formatLongDate } from "@/lib/utils";

export function DateOperations({
  dates,
  operatingDate
}: {
  dates: DateRecord[];
  operatingDate: DateRecord | null;
}) {
  const [createState, createAction, createPending] = useActionState(
    createDateAction,
    mutationInitialState
  );
  const [closeState, closeAction, closePending] = useActionState(
    closeDateAction,
    mutationInitialState
  );

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong className="section-title">Fechas</strong>
          <span className="chip">{dates.length}</span>
        </div>

        <MutationBanner state={closeState} />

        <div className="calendar-grid" style={{ marginTop: "1rem" }}>
          {dates.map((date) => (
            <article key={date.id} className="calendar-card">
              <div className="record-title">
                <strong>{formatLongDate(date.fechaCompleta)}</strong>
                <span>
                  {date.dia}/{date.mes}/{date.anio}
                </span>
              </div>
              <div className="chips-row">
                <span className="chip">{date.estado}</span>
                <span className="chip">{date.cierre ? "Cerrada" : "Abierta"}</span>
              </div>
              {!date.cierre && operatingDate?.id === date.id ? (
                <form action={closeAction}>
                  <input type="hidden" name="fecha_completa" value={date.fechaCompleta} />
                  <button className="button-secondary" type="submit" disabled={closePending}>
                    Cerrar
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </article>

      <article className="form-card">
        <strong className="section-title">Nueva fecha</strong>
        <MutationBanner state={createState} />
        <form action={createAction} className="field-grid" style={{ marginTop: "1rem" }}>
          <div className="field">
            <input id="fecha_completa" name="fecha_completa" type="date" />
          </div>
          <div className="field">
            <select id="estado" name="estado" defaultValue="abierto">
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
      </article>
    </section>
  );
}
