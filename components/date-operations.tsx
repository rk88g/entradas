"use client";

import { useActionState } from "react";
import { closeDateAction, createDateAction, mutationInitialState } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord } from "@/lib/types";
import { formatLongDate } from "@/lib/utils";

export function DateOperations({ dates, operatingDate }: { dates: DateRecord[]; operatingDate: DateRecord | null }) {
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
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Ultimas fechas registradas</strong>
          <span>
            Puedes cargar una nueva fecha y cerrar la fecha abierta para aplicar el orden y la
            numeracion de pases 618.
          </span>
        </div>

        <MutationBanner state={closeState} />

        <div className="calendar-grid" style={{ marginTop: closeState.success || closeState.error ? "1rem" : 0 }}>
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
                <span className="chip">{date.cierre ? "Cerrada" : "Abierta para captura"}</span>
              </div>
              {!date.cierre && operatingDate?.id === date.id ? (
                <form action={closeAction}>
                  <input type="hidden" name="fecha_completa" value={date.fechaCompleta} />
                  <button className="button-secondary" type="submit" disabled={closePending}>
                    Cerrar fecha
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </article>

      <article className="form-card">
        <h3>Registrar nueva fecha</h3>
        <MutationBanner state={createState} />
        <form action={createAction} className="field-grid" style={{ marginTop: createState.success || createState.error ? "1rem" : "1rem" }}>
          <div className="field">
            <label htmlFor="fecha_completa">Fecha</label>
            <input id="fecha_completa" name="fecha_completa" type="date" />
          </div>
          <div className="field">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue="abierto">
              <option value="abierto">Abierto</option>
              <option value="proximo">Proximo</option>
            </select>
          </div>
          <div className="actions-row">
            <button type="submit" className="button" disabled={createPending}>
              Guardar fecha
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}

