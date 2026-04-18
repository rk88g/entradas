"use client";

import { useActionState } from "react";
import { createDateAction, mutationInitialState } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { DateRecord } from "@/lib/types";
import { formatLongDate } from "@/lib/utils";

const statusLabels = {
  abierto: "Fecha operando",
  proximo: "Fecha siguiente",
  cerrado: "Fecha cerrada"
} as const;

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

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong className="section-title">Fechas</strong>
          <div className="tag-row">
            {operatingDate ? <span className="chip">{operatingDate.fechaCompleta}</span> : null}
            <span className="chip">{dates.length}</span>
          </div>
        </div>

        <div className="mini-list" style={{ marginBottom: "1rem" }}>
          <div className="mini-row">
            <span>Abierta</span>
            <strong>Fecha que se esta operando</strong>
          </div>
          <div className="mini-row">
            <span>Proximo</span>
            <strong>Fecha siguiente</strong>
          </div>
          <div className="mini-row">
            <span>Cerrado</span>
            <strong>Fecha finalizada</strong>
          </div>
        </div>

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
            <input id="fecha_completa" name="fecha_completa" type="date" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="estado">Uso de la fecha</label>
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
