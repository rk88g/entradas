"use client";

import { useActionState } from "react";
import { createVisitorAction, mutationInitialState } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { InternalRecord, VisitorRecord } from "@/lib/types";

export function VisitorManager({
  visitors,
  internals
}: {
  visitors: VisitorRecord[];
  internals: InternalRecord[];
}) {
  const [state, action, pending] = useActionState(createVisitorAction, mutationInitialState);

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong className="section-title">Visitas</strong>
          <span className="chip">{visitors.length}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Visita</th>
                <th>Sexo</th>
                <th>Edad</th>
                <th>Parentesco</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {visitors.length === 0 ? (
                <tr>
                  <td colSpan={5}>Sin visitas.</td>
                </tr>
              ) : (
                visitors.map((visitor) => (
                  <tr key={visitor.id}>
                    <td>
                      <div className="record-title">
                        <strong>{visitor.fullName}</strong>
                        <span>{visitor.historialInterno.join(", ") || "-"}</span>
                      </div>
                    </td>
                    <td>{visitor.sexo}</td>
                    <td>{visitor.edad}</td>
                    <td>{visitor.parentesco}</td>
                    <td>
                      <StatusBadge variant={visitor.betada ? "danger" : "ok"}>
                        {visitor.betada ? "Betada" : "Activa"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="form-card">
        <strong className="section-title">Nueva visita</strong>
        <MutationBanner state={state} />
        <form action={action} className="field-grid" style={{ marginTop: "1rem" }}>
          <div className="field">
            <input name="nombres" placeholder="Nombres" />
          </div>
          <div className="field">
            <input name="apellido_pat" placeholder="Apellido paterno" />
          </div>
          <div className="field">
            <input name="apellido_mat" placeholder="Apellido materno" />
          </div>
          <div className="field">
            <input name="fecha_nacimiento" type="date" />
          </div>
          <div className="field">
            <select name="sexo" defaultValue="sin-definir">
              <option value="sin-definir">Sexo</option>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
            </select>
          </div>
          <div className="field">
            <input name="parentesco" placeholder="Parentesco" />
          </div>
          <div className="field">
            <input name="telefono" placeholder="Telefono" />
          </div>
          <div className="field">
            <select name="betada" defaultValue="false">
              <option value="false">Activa</option>
              <option value="true">Betada</option>
            </select>
          </div>
          <div className="field">
            <select name="interno_id" defaultValue="">
              <option value="">Asignar a interno</option>
              {internals.map((internal) => (
                <option key={internal.id} value={internal.id}>
                  {internal.fullName} · {internal.ubicacion}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <input name="relation_parentesco" placeholder="Parentesco con interno" />
          </div>
          <label style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <input type="checkbox" name="titular" />
            Principal
          </label>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <textarea name="notas" placeholder="Notas" />
          </div>
          <div className="actions-row">
            <button type="submit" className="button" disabled={pending}>
              Guardar
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}
