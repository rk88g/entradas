"use client";

import { useActionState, useMemo, useState } from "react";
import { addEscaleraItemAction, saveEscaleraEntryAction } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { EscaleraRecord, MutationState, RoleKey } from "@/lib/types";
import { formatLongDate, getEscaleraStatusLabel } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

export function EscalerasPanel({
  records,
  roleKey
}: {
  records: EscaleraRecord[];
  roleKey: RoleKey;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entryState, entryAction, entryPending] = useActionState(
    saveEscaleraEntryAction,
    mutationInitialState
  );
  const [itemState, itemAction, itemPending] = useActionState(
    addEscaleraItemAction,
    mutationInitialState
  );
  const selectedRecord = records.find((item) => item.listadoId === selectedId) ?? null;
  const summary = useMemo(
    () => ({
      total: records.length,
      off8: records.filter((item) => item.off8Aplica).length,
      pendientes: records.filter((item) => item.status === "pendiente").length
    }),
    [records]
  );

  return (
    <>
      <section className="module-panel">
        <section className="stats-grid">
          <article className="stat-card">
            <small>Registros hoy</small>
            <strong>{summary.total}</strong>
          </article>
          <article className="stat-card">
            <small>Off8</small>
            <strong>{summary.off8}</strong>
          </article>
          <article className="stat-card">
            <small>Pendientes</small>
            <strong>{summary.pendientes}</strong>
          </article>
        </section>

        <article className="data-card" style={{ marginTop: "1rem" }}>
          <strong className="section-title">Escaleras del día en curso</strong>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Ubicacion</th>
                  <th>Interno</th>
                  <th>Labora</th>
                  <th>Off8</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin registros para Escaleras hoy.</td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr
                      key={record.listadoId}
                      onClick={() => setSelectedId(record.listadoId)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{record.internalLocation}</td>
                      <td>{record.internalName}</td>
                      <td>{record.laborando ? "Si" : "No"}</td>
                      <td>{record.off8Aplica ? "Aplica" : "No"}</td>
                      <td>{getEscaleraStatusLabel(record.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {selectedRecord ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 100
          }}
          onClick={() => setSelectedId(null)}
        >
          <div
            className="form-card"
            style={{ width: "min(100%, 1080px)", maxHeight: "90vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="record-title">
                <strong className="section-title">{selectedRecord.internalName}</strong>
                <span>
                  {selectedRecord.internalLocation} · {formatLongDate(selectedRecord.fechaVisita)}
                </span>
              </div>
              <button type="button" className="button-soft" onClick={() => setSelectedId(null)}>
                Cerrar
              </button>
            </div>

            <section className="module-grid" style={{ marginTop: "1rem" }}>
              <article className="data-card">
                <strong className="section-title">Pase y menciones</strong>
                <div className="stack" style={{ marginTop: "1rem" }}>
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <strong>Labora:</strong> {selectedRecord.laborando ? "Si" : "No"}
                  </div>
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <strong>Peticion</strong>
                    <div className="muted" style={{ marginTop: "0.5rem" }}>
                      {selectedRecord.basicRequest?.trim() || "Sin peticion."}
                    </div>
                  </div>
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <strong>Peticion especial</strong>
                    <div className="muted" style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                      {selectedRecord.specialRequest?.trim() || "Sin peticion especial."}
                    </div>
                  </div>
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <strong>Aparatos del pase</strong>
                    <div className="muted" style={{ marginTop: "0.5rem" }}>
                      {selectedRecord.passDeviceItems.length > 0
                        ? selectedRecord.passDeviceItems
                            .map((item) => `${item.name} [${item.quantity}]`)
                            .join(", ")
                        : "Sin aparatos en este pase."}
                    </div>
                  </div>
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <strong>Aparatos autorizados</strong>
                    <div className="muted" style={{ marginTop: "0.5rem" }}>
                      {selectedRecord.authorizedDevices.length > 0
                        ? selectedRecord.authorizedDevices
                            .map(
                              (item) =>
                                `${item.name} [${item.quantity}]${item.brand || item.model ? ` ${[item.brand, item.model].filter(Boolean).join(" / ")}` : ""}`
                            )
                            .join(", ")
                        : "Sin aparatos autorizados en Visual o Comunicacion."}
                    </div>
                  </div>
                </div>
              </article>

              <article className="form-card">
                <strong className="section-title">Cierre del registro</strong>
                <MutationBanner state={entryState} />
                <form action={entryAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                  <input type="hidden" name="listado_id" value={selectedRecord.listadoId} />
                  <input type="hidden" name="internal_id" value={selectedRecord.internalId} />
                  <input type="hidden" name="fecha_visita" value={selectedRecord.fechaVisita} />
                  <div className="field field-switch">
                    <label className="switch-row">
                      <input type="checkbox" name="off8_aplica" defaultChecked={selectedRecord.off8Aplica} />
                      <span className="switch-ui" />
                      Aplica Off8
                    </label>
                  </div>
                  <div className="field">
                    <select name="off8_type" defaultValue={selectedRecord.off8Type ?? ""}>
                      <option value="">Tipo de costo</option>
                      <option value="fijo">Fijo</option>
                      <option value="porcentual">Porcentual</option>
                    </select>
                  </div>
                  <div className="field">
                    <input
                      name="off8_value"
                      type="number"
                      step="0.01"
                      defaultValue={selectedRecord.off8Value ?? ""}
                      placeholder="Costo Off8"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <input
                      name="ticket_amount"
                      type="number"
                      step="0.01"
                      defaultValue={selectedRecord.ticketAmount ?? ""}
                      placeholder="Ticket de compra"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field">
                    <select name="status" defaultValue={selectedRecord.status}>
                      <option value="pendiente">Pendiente</option>
                      <option value="entregado">Entregado</option>
                      <option value="retenido">Retenido</option>
                      <option value="rechazado">No entregado</option>
                    </select>
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea
                      name="retenciones"
                      defaultValue={selectedRecord.retentions ?? ""}
                      placeholder="Retenciones o faltas"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea
                      name="comentarios"
                      defaultValue={selectedRecord.comments ?? ""}
                      placeholder="Notas o comentarios"
                      autoComplete="off"
                    />
                  </div>
                  <div className="actions-row">
                    <button type="submit" className="button" disabled={entryPending}>
                      Guardar registro
                    </button>
                  </div>
                </form>

                <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1.5rem 0" }} />

                <strong className="section-title">Articulos que ingresan</strong>
                <MutationBanner state={itemState} />
                <form action={itemAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                  <input type="hidden" name="listado_id" value={selectedRecord.listadoId} />
                  <input type="hidden" name="internal_id" value={selectedRecord.internalId} />
                  <input type="hidden" name="fecha_visita" value={selectedRecord.fechaVisita} />
                  <div className="field">
                    <input name="description" placeholder="Articulo" autoComplete="off" />
                  </div>
                  <div className="field">
                    <input name="quantity" type="number" min="1" defaultValue="1" autoComplete="off" />
                  </div>
                  <div className="field">
                    <input name="unit_label" placeholder="Unidad" autoComplete="off" />
                  </div>
                  <div className="field">
                    <input name="weight_kg" type="number" step="0.01" placeholder="Peso kg" autoComplete="off" />
                  </div>
                  <div className="field">
                    <input name="liters" type="number" step="0.01" placeholder="Litros" autoComplete="off" />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="notes" placeholder="Notas del articulo" autoComplete="off" />
                  </div>
                  <div className="actions-row">
                    <button type="submit" className="button-secondary" disabled={itemPending}>
                      Agregar articulo
                    </button>
                  </div>
                </form>

                <div className="table-wrap" style={{ marginTop: "1rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Articulo</th>
                        <th>Cantidad</th>
                        <th>Peso</th>
                        <th>Litros</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecord.manualItems.length === 0 ? (
                        <tr>
                          <td colSpan={5}>Sin articulos manuales capturados.</td>
                        </tr>
                      ) : (
                        selectedRecord.manualItems.map((item) => (
                          <tr key={item.id}>
                            <td>{item.description}</td>
                            <td>
                              {item.quantity}
                              {item.unitLabel ? ` ${item.unitLabel}` : ""}
                            </td>
                            <td>{item.weightKg ?? "-"}</td>
                            <td>{item.liters ?? "-"}</td>
                            <td>{item.notes ?? "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
