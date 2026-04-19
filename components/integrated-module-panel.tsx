"use client";

import { useActionState, useMemo, useState } from "react";
import {
  assignModuleDeviceAction,
  assignModuleWorkerAction,
  closeModuleWeekAction,
  createModuleZoneAction,
  registerModulePaymentAction,
  saveModulePriceAction
} from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import {
  InternalDeviceRecord,
  ModuleAccess,
  ModulePanelData,
  ModuleWorkerFunctionKey,
  MutationState,
  RoleKey
} from "@/lib/types";
import { canManageModuleFunction } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

type ModuleTab = "resumen" | "aparatos" | "cobranza" | "configuracion";

const workerFunctions: Array<{ key: ModuleWorkerFunctionKey; label: string }> = [
  { key: "altas", label: "Altas" },
  { key: "cobranza", label: "Cobranza" },
  { key: "encargado", label: "Encargado" },
  { key: "consulta", label: "Consulta" },
  { key: "configuracion", label: "Configuracion" }
];

export function IntegratedModulePanel({
  data,
  internals,
  roleKey,
  accesses
}: {
  data: ModulePanelData;
  internals: Array<{ id: string; fullName: string; ubicacion: number }>;
  roleKey: RoleKey;
  accesses: ModuleAccess[];
}) {
  const [tab, setTab] = useState<ModuleTab>("resumen");
  const [selectedInternalId, setSelectedInternalId] = useState<string | null>(null);
  const [zoneState, zoneAction, zonePending] = useActionState(createModuleZoneAction, mutationInitialState);
  const [priceState, priceAction, pricePending] = useActionState(saveModulePriceAction, mutationInitialState);
  const [deviceState, deviceAction, devicePending] = useActionState(assignModuleDeviceAction, mutationInitialState);
  const [paymentState, paymentAction, paymentPending] = useActionState(registerModulePaymentAction, mutationInitialState);
  const [workerState, workerAction, workerPending] = useActionState(assignModuleWorkerAction, mutationInitialState);
  const [closeState, closeAction, closePending] = useActionState(closeModuleWeekAction, mutationInitialState);

  const groupedInternals = useMemo(() => {
    const map = new Map<
      string,
      {
        internalId: string;
        internalName: string;
        internalLocation: number;
        devices: InternalDeviceRecord[];
      }
    >();

    data.devices.forEach((device) => {
      const current = map.get(device.internalId) ?? {
        internalId: device.internalId,
        internalName: device.internalName,
        internalLocation: device.internalLocation,
        devices: []
      };
      current.devices.push(device);
      map.set(device.internalId, current);
    });

    return [...map.values()].sort((a, b) => a.internalLocation - b.internalLocation);
  }, [data.devices]);

  const selectedInternal = groupedInternals.find((item) => item.internalId === selectedInternalId) ?? null;
  const visibleModalDevices =
    data.moduleKey === "visual"
      ? selectedInternal?.devices.filter((device) =>
          ["Pantalla", "Consola", "Sonido"].includes(device.deviceTypeName)
        ) ?? []
      : selectedInternal?.devices ?? [];

  const canManageConfig = canManageModuleFunction(roleKey, accesses, data.moduleKey, "configuracion");
  const canManageCharges = canManageModuleFunction(roleKey, accesses, data.moduleKey, "cobranza");
  const canManageEntries = canManageModuleFunction(roleKey, accesses, data.moduleKey, "altas");

  return (
    <>
      <section className="module-panel">
        <div className="toolbar hide-print">
          <button
            type="button"
            className={`button-secondary listing-toggle ${tab === "resumen" ? "active" : ""}`}
            onClick={() => setTab("resumen")}
          >
            Resumen
          </button>
          <button
            type="button"
            className={`button-secondary listing-toggle ${tab === "aparatos" ? "active" : ""}`}
            onClick={() => setTab("aparatos")}
          >
            Aparatos
          </button>
          <button
            type="button"
            className={`button-secondary listing-toggle ${tab === "cobranza" ? "active" : ""}`}
            onClick={() => setTab("cobranza")}
          >
            Cobranza
          </button>
          <button
            type="button"
            className={`button-secondary listing-toggle ${tab === "configuracion" ? "active" : ""}`}
            onClick={() => setTab("configuracion")}
          >
            Configuracion
          </button>
        </div>

        {tab === "resumen" ? (
          <div className="stack" style={{ marginTop: "1rem" }}>
            {data.unpaidDevices.length > 0 ? (
              <div className="alert-box">
                {data.unpaidDevices.length} aparatos sin pago de semana en {data.moduleName}.
              </div>
            ) : null}

            <section className="stats-grid">
              <article className="stat-card">
                <small>Semana</small>
                <strong>{data.currentWeekLabel}</strong>
              </article>
              <article className="stat-card">
                <small>Pagados</small>
                <strong>{data.paidDevices.length}</strong>
              </article>
              <article className="stat-card">
                <small>No pagados</small>
                <strong>{data.unpaidDevices.length}</strong>
              </article>
              <article className="stat-card">
                <small>Ingreso</small>
                <strong>${data.totalIncome.toFixed(2)}</strong>
              </article>
            </section>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Interno</th>
                    <th>Ubicacion</th>
                    <th>Aparatos</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInternals.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Sin aparatos registrados.</td>
                    </tr>
                  ) : (
                    groupedInternals.map((item) => (
                      <tr
                        key={item.internalId}
                        onClick={() => setSelectedInternalId(item.internalId)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>{item.internalName}</td>
                        <td>{item.internalLocation}</td>
                        <td>{item.devices.map((device) => device.deviceTypeName).join(", ")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "aparatos" ? (
          <div className="module-grid" style={{ marginTop: "1rem" }}>
            <article className="data-card">
              <strong className="section-title">Listado</strong>
              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Interno</th>
                      <th>Aparato</th>
                      <th>Zona</th>
                      <th>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devices.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Sin aparatos.</td>
                      </tr>
                    ) : (
                      data.devices.map((device) => (
                        <tr key={device.id}>
                          <td>{device.internalName}</td>
                          <td>{device.deviceTypeName}</td>
                          <td>{device.zoneName ?? "-"}</td>
                          <td>{device.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="form-card">
              <strong className="section-title">Alta manual</strong>
              <MutationBanner state={deviceState} />
              <form action={deviceAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="internal_id" defaultValue="" required disabled={!canManageEntries || data.weekClosed}>
                    <option value="" disabled>
                      Interno
                    </option>
                    {internals.map((internal) => (
                      <option key={internal.id} value={internal.id}>
                        {internal.fullName} - {internal.ubicacion}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="device_type_id" defaultValue="" required disabled={!canManageEntries || data.weekClosed}>
                    <option value="" disabled>
                      Tipo de aparato
                    </option>
                    {data.deviceTypes.map((deviceType) => (
                      <option key={deviceType.id} value={deviceType.id}>
                        {deviceType.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="zone_id" defaultValue="" disabled={!canManageEntries || data.weekClosed}>
                    <option value="">Zona</option>
                    {data.zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <input name="brand" placeholder="Marca" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field">
                  <input name="model" placeholder="Modelo" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field">
                  <input name="imei" placeholder="IMEI" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field">
                  <input name="chip_number" placeholder="Numero de chip" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field">
                  <input name="quantity" type="number" min="1" defaultValue="1" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field">
                  <label>
                    <input type="checkbox" name="cameras_allowed" disabled={!canManageEntries || data.weekClosed} /> Permitir camaras
                  </label>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea name="characteristics" placeholder="Caracteristicas" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea name="notes" placeholder="Notas" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="actions-row">
                  <button type="submit" className="button" disabled={devicePending || !canManageEntries || data.weekClosed}>
                    Guardar aparato
                  </button>
                </div>
              </form>
            </article>
          </div>
        ) : null}

        {tab === "cobranza" ? (
          <div className="module-grid" style={{ marginTop: "1rem" }}>
            <article className="data-card">
              <strong className="section-title">Resumen por zona</strong>
              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Zona</th>
                      <th>Pagados</th>
                      <th>No pagados</th>
                      <th>Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.totalsByZone.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Sin datos.</td>
                      </tr>
                    ) : (
                      data.totalsByZone.map((zone) => (
                        <tr key={zone.zoneName}>
                          <td>{zone.zoneName}</td>
                          <td>{zone.paidCount}</td>
                          <td>{zone.pendingCount}</td>
                          <td>${zone.totalPaid.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="form-card">
              <strong className="section-title">Registrar pago</strong>
              <MutationBanner state={paymentState} />
              <form action={paymentAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="internal_device_id" defaultValue="" required disabled={!canManageCharges || data.weekClosed}>
                    <option value="" disabled>
                      Aparato
                    </option>
                    {data.devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.internalLocation} - {device.internalName} - {device.deviceTypeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="zone_id" defaultValue="" disabled={!canManageCharges || data.weekClosed}>
                    <option value="">Zona</option>
                    {data.zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <input name="amount" type="number" step="0.01" placeholder="Cantidad" autoComplete="off" disabled={!canManageCharges || data.weekClosed} />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea name="notes" placeholder="Notas del pago" autoComplete="off" disabled={!canManageCharges || data.weekClosed} />
                </div>
                <div className="actions-row">
                  <button type="submit" className="button" disabled={paymentPending || !canManageCharges || data.weekClosed}>
                    Registrar pago
                  </button>
                </div>
              </form>
            </article>
          </div>
        ) : null}

        {tab === "configuracion" ? (
          <div className="module-grid" style={{ marginTop: "1rem" }}>
            <article className="form-card">
              <strong className="section-title">Zonas y precios</strong>
              <MutationBanner state={zoneState} />
              <form action={zoneAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <input name="name" placeholder="Zona" autoComplete="off" disabled={!canManageConfig || data.weekClosed} />
                </div>
                <div className="field">
                  <select name="charge_weekday" defaultValue="1" disabled={!canManageConfig || data.weekClosed}>
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miercoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sabado</option>
                    <option value="0">Domingo</option>
                  </select>
                </div>
                <div className="actions-row">
                  <button type="submit" className="button-secondary" disabled={zonePending || !canManageConfig || data.weekClosed}>
                    Guardar zona
                  </button>
                </div>
              </form>

              <MutationBanner state={priceState} />
              <form action={priceAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="device_type_id" defaultValue="" required disabled={!canManageConfig || data.weekClosed}>
                    <option value="" disabled>
                      Aparato
                    </option>
                    {data.deviceTypes.map((deviceType) => (
                      <option key={deviceType.id} value={deviceType.id}>
                        {deviceType.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <input name="weekly_price" type="number" step="0.01" placeholder="Precio semanal" autoComplete="off" disabled={!canManageConfig || data.weekClosed} />
                </div>
                <div className="field">
                  <input name="discount_amount" type="number" step="0.01" placeholder="Descuento" autoComplete="off" disabled={!canManageConfig || data.weekClosed} />
                </div>
                <div className="actions-row">
                  <button type="submit" className="button-secondary" disabled={pricePending || !canManageConfig || data.weekClosed}>
                    Guardar precio
                  </button>
                </div>
              </form>
            </article>

            <article className="form-card">
              <strong className="section-title">Trabajadores</strong>
              <MutationBanner state={workerState} />
              <form action={workerAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="user_id" defaultValue="" disabled={!canManageConfig}>
                    <option value="" disabled>
                      Usuario del sistema
                    </option>
                    {data.assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <strong>Funciones</strong>
                  <div className="article-grid">
                    {workerFunctions.map((fn) => (
                      <label key={fn.key}>
                        <input type="checkbox" name="functions" value={fn.key} disabled={!canManageConfig} /> {fn.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>
                    <input type="checkbox" name="module_only" disabled={!canManageConfig} /> Solo vera este bloque
                  </label>
                </div>
                <div className="actions-row">
                  <button type="submit" className="button-secondary" disabled={workerPending || !canManageConfig}>
                    Guardar trabajador
                  </button>
                </div>
              </form>

              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Funciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.workers.length === 0 ? (
                      <tr>
                        <td colSpan={2}>Sin trabajadores asignados.</td>
                      </tr>
                    ) : (
                      data.workers.map((worker) => (
                        <tr key={worker.id}>
                          <td>{worker.fullName}</td>
                          <td>{worker.functions.join(", ") || "Sin funciones"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {(roleKey === "super-admin" || roleKey === "control") && data.currentCycleId ? (
                <div style={{ marginTop: "1rem" }}>
                  <MutationBanner state={closeState} />
                  <form action={closeAction} className="field-grid" autoComplete="off">
                    <input type="hidden" name="module_key" value={data.moduleKey} />
                    <input type="hidden" name="cycle_id" value={data.currentCycleId} />
                    <div className="actions-row">
                      <button type="submit" className="button" disabled={closePending || data.weekClosed}>
                        Cerrar semana
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </article>
          </div>
        ) : null}
      </section>

      {selectedInternal ? (
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
          onClick={() => setSelectedInternalId(null)}
        >
          <div
            className="form-card"
            style={{ width: "min(100%, 920px)", maxHeight: "90vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div className="record-title">
                <strong className="section-title">{selectedInternal.internalName}</strong>
                <span>Ubicacion {selectedInternal.internalLocation}</span>
              </div>
              <button type="button" className="button-soft" onClick={() => setSelectedInternalId(null)}>
                Cerrar
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Aparato</th>
                    <th>Marca / Modelo</th>
                    <th>Estatus</th>
                    <th>Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModalDevices.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sin aparatos visibles para este bloque.</td>
                    </tr>
                  ) : (
                    visibleModalDevices.map((device) => (
                      <tr key={device.id}>
                        <td>{device.deviceTypeName}</td>
                        <td>{[device.brand, device.model].filter(Boolean).join(" / ") || "-"}</td>
                        <td>{device.status}</td>
                        <td>{device.zoneName ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
