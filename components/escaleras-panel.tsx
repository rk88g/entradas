"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { addEscaleraItemAction, payAduanaEntryAction, saveEscaleraEntryAction } from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { EscaleraRecord, MutationState } from "@/lib/types";
import { formatLongDate, getEscaleraStatusMeta } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function EscaleraEditor({
  record,
  onClose,
  aduanaMode = false
}: {
  record: EscaleraRecord;
  onClose: () => void;
  aduanaMode?: boolean;
}) {
  const [entryState, entryAction, entryPending] = useActionState(saveEscaleraEntryAction, mutationInitialState);
  const [itemState, itemAction, itemPending] = useActionState(addEscaleraItemAction, mutationInitialState);
  const [payState, payAction, payPending] = useActionState(payAduanaEntryAction, mutationInitialState);
  const [off8Aplica, setOff8Aplica] = useState(record.off8Aplica);
  const [off8Type, setOff8Type] = useState(record.off8Type ?? "");
  const [ticketAmount, setTicketAmount] = useState(record.ticketAmount ? String(record.ticketAmount) : "");
  const [percent, setPercent] = useState(record.off8Percent ? String(record.off8Percent) : "");
  const [costValue, setCostValue] = useState(record.off8Value ? String(record.off8Value) : "");

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (off8Type === "porcentual") {
      const ticket = Number(ticketAmount);
      const value = Number(percent);
      if (Number.isFinite(ticket) && Number.isFinite(value) && ticket > 0 && value > 0) {
        setCostValue(((ticket * value) / 100).toFixed(2));
      } else {
        setCostValue("");
      }
    }
  }, [off8Type, percent, ticketAmount]);

  const itemSummary = record.manualItems.length;
  const nextStatusLabel = off8Aplica && off8Type !== "libre" ? "Enviado" : "Entregado";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="form-card"
        style={{ width: "min(100%, 1080px)", maxHeight: "90vh", overflow: "auto" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="record-title">
            <strong className="section-title">{record.internalName}</strong>
            <span>
              {record.internalLocation} · {formatLongDate(record.fechaVisita)}
            </span>
          </div>
          <button type="button" className="button-soft" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <section className="collapse-stack" style={{ marginTop: "1rem" }}>
          <details className="data-card section-collapse" open>
            <summary>
              <span>Pase y menciones</span>
              <span>{formatLongDate(record.fechaVisita)}</span>
            </summary>
            <div className="section-collapse-body">
              <div className="stack">
                <div className="data-card" style={{ padding: "1rem" }}>
                  <strong>Labora:</strong> {record.laborando ? "Si" : "No"}
                </div>
                <div className="data-card" style={{ padding: "1rem" }}>
                  <strong>Peticion</strong>
                  <div className="muted" style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                    {record.basicRequest?.trim() || "Sin peticion."}
                  </div>
                </div>
                <div className="data-card" style={{ padding: "1rem" }}>
                  <strong>Peticion especial</strong>
                  <div className="muted" style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap" }}>
                    {record.specialRequest?.trim() || "Sin peticion especial."}
                  </div>
                </div>
                <div className="data-card" style={{ padding: "1rem" }}>
                  <strong>Articulos del pase</strong>
                  <div className="muted" style={{ marginTop: "0.5rem" }}>
                    {record.passDeviceItems.length > 0
                      ? record.passDeviceItems.map((item) => `${item.name} [${item.quantity}]`).join(", ")
                      : "Sin articulos declarados en el pase."}
                  </div>
                </div>
              </div>
            </div>
          </details>

          <details className="data-card section-collapse" open>
            <summary>
              <span>Articulos que ingresan</span>
              <span>{itemSummary} registros</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={itemState} />
              <form action={itemAction} className="field-grid" autoComplete="off">
                <input type="hidden" name="listado_id" value={record.listadoId} />
                <input type="hidden" name="internal_id" value={record.internalId} />
                <input type="hidden" name="fecha_visita" value={record.fechaVisita} />
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
                  <LoadingButton pending={itemPending} label="Agregar articulo" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <div className="table-wrap compact-table" style={{ marginTop: "1rem" }}>
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
                    {record.manualItems.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Sin articulos manuales capturados.</td>
                      </tr>
                    ) : (
                      record.manualItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.description}</td>
                          <td>{item.quantity}{item.unitLabel ? ` ${item.unitLabel}` : ""}</td>
                          <td>{item.weightKg ?? "-"}</td>
                          <td>{item.liters ?? "-"}</td>
                          <td>{item.notes ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          {!aduanaMode ? (
            <details className="data-card section-collapse" open>
              <summary>
                <span>Cierre del registro</span>
                <span>{getEscaleraStatusMeta(record.status).label}</span>
              </summary>
              <div className="section-collapse-body">
                <MutationBanner state={entryState} />
                <form action={entryAction} className="field-grid" autoComplete="off">
                  <input type="hidden" name="listado_id" value={record.listadoId} />
                  <input type="hidden" name="internal_id" value={record.internalId} />
                  <input type="hidden" name="fecha_visita" value={record.fechaVisita} />
                  <input type="hidden" name="off8_value" value={costValue} />
                  <input type="hidden" name="status" value={off8Type === "libre" ? "entregado" : nextStatusLabel.toLowerCase()} />

                  <div className="field field-switch">
                    <label className="switch-row">
                      <input type="checkbox" name="off8_aplica" checked={off8Aplica} onChange={(event) => setOff8Aplica(event.target.checked)} />
                      <span className="switch-ui" />
                      Aplica Off8
                    </label>
                  </div>
                  {off8Type !== "libre" ? (
                    <div className="field">
                      <input
                        name="ticket_amount"
                        type="number"
                        step="0.01"
                        value={ticketAmount}
                        onChange={(event) => setTicketAmount(event.target.value)}
                        placeholder="Ticket"
                        autoComplete="off"
                        disabled={!off8Aplica}
                      />
                    </div>
                  ) : null}
                  <div className="field">
                    <select name="off8_type" value={off8Type} onChange={(event) => setOff8Type(event.target.value)}>
                      <option value="">Tipo de costo</option>
                      <option value="fijo">Fijo</option>
                      <option value="porcentual">Porcentual</option>
                      <option value="libre">Libre</option>
                    </select>
                  </div>
                  {off8Type === "porcentual" ? (
                    <div className="field">
                      <input
                        name="off8_percent"
                        type="number"
                        min="1"
                        max="100"
                        value={percent}
                        onChange={(event) => setPercent(event.target.value)}
                        placeholder="Porcentaje"
                        autoComplete="off"
                      />
                    </div>
                  ) : null}
                  {off8Type !== "libre" ? (
                    <div className="field">
                      <input
                        name="off8_value_view"
                        type="number"
                        step="0.01"
                        value={costValue}
                        onChange={(event) => setCostValue(event.target.value)}
                        placeholder="Costo Off8"
                        autoComplete="off"
                        readOnly={off8Type === "porcentual"}
                      />
                    </div>
                  ) : null}
                  <div className="field">
                    <input value={nextStatusLabel} readOnly placeholder="Estatus final" autoComplete="off" />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="retenciones" defaultValue={record.retentions ?? ""} placeholder="Retenciones o faltas" autoComplete="off" />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="comentarios" defaultValue={record.comments ?? ""} placeholder="Notas o comentarios" autoComplete="off" />
                  </div>
                  <div className="actions-row">
                    <LoadingButton pending={entryPending} label="Guardar registro" loadingLabel="Loading..." className="button" />
                  </div>
                </form>
              </div>
            </details>
          ) : (
            <details className="data-card section-collapse" open>
              <summary>
                <span>Cobro en aduana</span>
                <span>{getEscaleraStatusMeta(record.status).label}</span>
              </summary>
              <div className="section-collapse-body">
                <MutationBanner state={payState} />
                <form action={payAction} className="field-grid" autoComplete="off">
                  <input type="hidden" name="entry_id" value={record.id} />
                  <div className="field">
                    <input
                      name="paid_amount"
                      type="number"
                      step="0.01"
                      defaultValue={record.off8Value ?? record.ticketAmount ?? ""}
                      placeholder="Monto pagado"
                      autoComplete="off"
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="comments" defaultValue={record.comments ?? ""} placeholder="Confirmacion de articulos y comentarios" autoComplete="off" />
                  </div>
                  <div className="actions-row">
                    <LoadingButton pending={payPending} label="Registrar pago" loadingLabel="Loading..." className="button" />
                  </div>
                </form>
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

export function EscalerasPanel({
  records
}: {
  records: EscaleraRecord[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
          <article className="stat-card"><small>Registros hoy</small><strong>{summary.total}</strong></article>
          <article className="stat-card"><small>Off8</small><strong>{summary.off8}</strong></article>
          <article className="stat-card"><small>Pendientes</small><strong>{summary.pendientes}</strong></article>
        </section>

        <details className="data-card section-collapse" style={{ marginTop: "1rem" }} open>
          <summary>
            <span>Escaleras del dia en curso</span>
            <span>{records.length} registros</span>
          </summary>
          <div className="section-collapse-body">
            <div className="table-wrap compact-table">
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
                    <tr><td colSpan={5}>Sin registros para Escaleras hoy.</td></tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.listadoId} onClick={() => setSelectedId(record.listadoId)} style={{ cursor: "pointer" }}>
                        <td>{record.internalLocation}</td>
                        <td>{record.internalName}</td>
                        <td>{record.laborando ? "Si" : "No"}</td>
                        <td>{record.off8Aplica ? "Aplica" : "No"}</td>
                        <td>
                          <StatusBadge variant={getEscaleraStatusMeta(record.status).variant}>
                            {getEscaleraStatusMeta(record.status).label}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      {selectedRecord ? <EscaleraEditor record={selectedRecord} onClose={() => setSelectedId(null)} /> : null}
    </>
  );
}

export function AduanaPanel({
  records
}: {
  records: EscaleraRecord[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRecord = records.find((item) => item.id === selectedId) ?? null;
  const totalIngresos = records.reduce((sum, item) => sum + Number(item.off8Value ?? item.ticketAmount ?? 0), 0);

  return (
    <>
      <section className="module-panel">
        <section className="stats-grid">
          <article className="stat-card"><small>Registros</small><strong>{records.length}</strong></article>
          <article className="stat-card"><small>Pagados</small><strong>{records.filter((item) => item.status === "pagado").length}</strong></article>
          <article className="stat-card"><small>Ingresos</small><strong>${totalIngresos.toFixed(2)}</strong></article>
        </section>

        <details className="data-card section-collapse" style={{ marginTop: "1rem" }} open>
          <summary>
            <span>Aduana del dia en curso</span>
            <span>{records.length} registros</span>
          </summary>
          <div className="section-collapse-body">
            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Ubicacion</th>
                    <th>Interno</th>
                    <th>Off8</th>
                    <th>Estatus</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={4}>Sin registros para Aduana hoy.</td></tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id} onClick={() => setSelectedId(record.id)} style={{ cursor: "pointer" }}>
                        <td>{record.internalLocation}</td>
                        <td>{record.internalName}</td>
                        <td>${Number(record.off8Value ?? record.ticketAmount ?? 0).toFixed(2)}</td>
                        <td>
                          <StatusBadge variant={getEscaleraStatusMeta(record.status).variant}>
                            {getEscaleraStatusMeta(record.status).label}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      {selectedRecord ? <EscaleraEditor record={selectedRecord} onClose={() => setSelectedId(null)} aduanaMode /> : null}
    </>
  );
}
