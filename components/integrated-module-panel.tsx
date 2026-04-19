"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  assignModuleDeviceAction,
  closeModuleWeekAction,
  registerModulePaymentAction
} from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import {
  InternalDeviceRecord,
  ModuleAccess,
  ModulePanelData,
  MutationState,
  RoleKey
} from "@/lib/types";
import { canManageModuleFunction, compareInternalLocations, formatLongDate } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

type ModuleTab = "resumen" | "aparatos" | "cobranza";

function getZonePrefix(zoneName?: string) {
  const match = /m(\d+)/i.exec(zoneName ?? "");
  return match?.[1] ?? null;
}

function matchesZoneByLocation(zoneName: string | undefined, internalLocation: string) {
  const prefix = getZonePrefix(zoneName);
  if (!prefix) {
    return true;
  }

  return String(internalLocation).split("-")[0] === prefix;
}

function getDeviceWeeklyCharge(
  device: InternalDeviceRecord,
  priceMap: Map<string, { weeklyPrice: number; activationPrice: number; discountAmount: number }>
) {
  const configured = priceMap.get(device.deviceTypeId);
  if (device.status === "pendiente") {
    return configured?.activationPrice ?? 0;
  }

  const baseAmount = device.weeklyPriceOverride ?? configured?.weeklyPrice ?? 0;
  const discount = device.discountOverride ?? configured?.discountAmount ?? 0;
  return Math.max(0, (baseAmount - discount) * Math.max(device.quantity, 1));
}

export function IntegratedModulePanel({
  data,
  internals,
  roleKey,
  accesses
}: {
  data: ModulePanelData;
  internals: Array<{ id: string; fullName: string; ubicacion: string }>;
  roleKey: RoleKey;
  accesses: ModuleAccess[];
}) {
  const [tab, setTab] = useState<ModuleTab>("resumen");
  const [selectedInternalId, setSelectedInternalId] = useState<string | null>(null);
  const [selectedChargeInternalId, setSelectedChargeInternalId] = useState("");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState("");
  const [deviceState, deviceAction, devicePending] = useActionState(assignModuleDeviceAction, mutationInitialState);
  const [paymentState, paymentAction, paymentPending] = useActionState(registerModulePaymentAction, mutationInitialState);
  const [closeState, closeAction, closePending] = useActionState(closeModuleWeekAction, mutationInitialState);
  const canManageCharges = canManageModuleFunction(roleKey, accesses, data.moduleKey, "cobranza");
  const canManageEntries = canManageModuleFunction(roleKey, accesses, data.moduleKey, "altas");
  const canCloseWeek =
    roleKey === "super-admin" ||
    canManageModuleFunction(roleKey, accesses, data.moduleKey, "encargado");

  const priceMap = useMemo(
    () =>
      new Map(
        data.prices.map((item) => [
          item.deviceTypeId,
          {
            weeklyPrice: item.weeklyPrice,
            activationPrice: item.activationPrice,
            discountAmount: item.discountAmount
          }
        ])
      ),
    [data.prices]
  );

  const groupedInternals = useMemo(() => {
    const map = new Map<
      string,
      {
        internalId: string;
        internalName: string;
        internalLocation: string;
        devices: InternalDeviceRecord[];
        totalDue: number;
      }
    >();

    data.devices.forEach((device) => {
      const current = map.get(device.internalId) ?? {
        internalId: device.internalId,
        internalName: device.internalName,
        internalLocation: device.internalLocation,
        devices: [],
        totalDue: 0
      };
      current.devices.push(device);
      if (device.status !== "baja") {
        current.totalDue += getDeviceWeeklyCharge(device, priceMap);
      }
      map.set(device.internalId, current);
    });

    return [...map.values()].sort((a, b) => compareInternalLocations(a.internalLocation, b.internalLocation));
  }, [data.devices, priceMap]);

  const filteredInternalsForZone = groupedInternals.filter((item) => {
    if (!selectedZoneFilter) {
      return true;
    }

    const zone = data.zones.find((entry) => entry.id === selectedZoneFilter);
    if (!zone) {
      return true;
    }

    return item.devices.some(
      (device) => device.zoneId === zone.id || matchesZoneByLocation(zone.name, item.internalLocation)
    );
  });

  const selectedInternal = groupedInternals.find((item) => item.internalId === selectedInternalId) ?? null;
  const selectedChargeInternal = filteredInternalsForZone.find((item) => item.internalId === selectedChargeInternalId) ?? null;

  useEffect(() => {
    if (!selectedInternalId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedInternalId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedInternalId]);

  return (
    <>
      <section className="module-panel">
        <div className="toolbar hide-print">
          <button type="button" className={`button-secondary listing-toggle ${tab === "resumen" ? "active" : ""}`} onClick={() => setTab("resumen")}>
            Resumen
          </button>
          <button type="button" className={`button-secondary listing-toggle ${tab === "aparatos" ? "active" : ""}`} onClick={() => setTab("aparatos")}>
            Aparatos
          </button>
          <button type="button" className={`button-secondary listing-toggle ${tab === "cobranza" ? "active" : ""}`} onClick={() => setTab("cobranza")}>
            Cobranza
          </button>
        </div>

        {tab === "resumen" ? (
          <div className="stack" style={{ marginTop: "1rem" }}>
            <article className="data-card" style={{ padding: "0.9rem 1.1rem" }}>
              <strong>{`Semana del ${formatLongDate(data.currentWeekLabel.slice(0, 10))} al ${formatLongDate(data.currentWeekLabel.slice(-10))}`}</strong>
            </article>

            {data.pendingDevices.length > 0 ? (
              <div className="alert-box">
                {data.pendingDevices.length} altas pendientes en {data.moduleName}.
              </div>
            ) : null}

            <section className="stats-grid">
              <article className="stat-card"><small>Pagados</small><strong>{data.paidDevices.length}</strong></article>
              <article className="stat-card"><small>Pendientes</small><strong>{data.unpaidDevices.length}</strong></article>
              <article className="stat-card"><small>Altas</small><strong>{data.pendingDevices.length}</strong></article>
              <article className="stat-card"><small>Mantenimiento</small><strong>{data.devices.filter((item) => item.status === "reparacion").length}</strong></article>
              <article className="stat-card"><small>Retenidos</small><strong>{data.devices.filter((item) => item.status === "retenido").length}</strong></article>
              <article className="stat-card"><small>Ingresos</small><strong>${data.totalIncome.toFixed(2)}</strong></article>
            </section>

            <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Zona</th>
                    <th>Pagados</th>
                    <th>Pendientes</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totalsByZone.length === 0 ? (
                    <tr><td colSpan={4}>Sin zonas registradas.</td></tr>
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

            {canCloseWeek && data.currentCycleId ? (
              <article className="form-card">
                <strong className="section-title">Cerrar semana</strong>
                <MutationBanner state={closeState} />
                <form action={closeAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
                  <input type="hidden" name="module_key" value={data.moduleKey} />
                  <input type="hidden" name="cycle_id" value={data.currentCycleId} />
                  <div className="actions-row">
                    <LoadingButton pending={closePending} label="Cerrar semana" loadingLabel="Loading..." className="button" disabled={data.weekClosed} />
                  </div>
                </form>
              </article>
            ) : null}
          </div>
        ) : null}

        {tab === "aparatos" ? (
          <div className="module-grid" style={{ marginTop: "1rem" }}>
            <article className="data-card">
              <strong className="section-title">Listado</strong>
              <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Interno</th>
                      <th>Ubicacion</th>
                      <th>Dispositivo</th>
                      <th>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devices.length === 0 ? (
                      <tr><td colSpan={4}>Sin aparatos.</td></tr>
                    ) : (
                      data.devices.map((device) => (
                        <tr key={device.id} onClick={() => setSelectedInternalId(device.internalId)} style={{ cursor: "pointer" }}>
                          <td>{device.internalName}</td>
                          <td>{device.internalLocation}</td>
                          <td>{`${device.quantity} ${device.deviceTypeName}`}</td>
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
              <form action={deviceAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="internal_id" defaultValue="" disabled={!canManageEntries || data.weekClosed}>
                    <option value="" disabled>Interno</option>
                    {internals.map((internal) => (
                      <option key={internal.id} value={internal.id}>
                        {internal.ubicacion} - {internal.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="device_type_id" defaultValue="" disabled={!canManageEntries || data.weekClosed}>
                    <option value="" disabled>Dispositivo</option>
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
                <div className="field"><input name="brand" placeholder="Marca" autoComplete="off" disabled={!canManageEntries || data.weekClosed} /></div>
                <div className="field"><input name="model" placeholder="Modelo" autoComplete="off" disabled={!canManageEntries || data.weekClosed} /></div>
                <div className="field"><input name="imei" placeholder="IMEI" autoComplete="off" disabled={!canManageEntries || data.weekClosed} /></div>
                <div className="field"><input name="chip_number" placeholder="Numero de chip" autoComplete="off" disabled={!canManageEntries || data.weekClosed} /></div>
                <div className="field"><input name="quantity" type="number" min="1" defaultValue="1" autoComplete="off" disabled={!canManageEntries || data.weekClosed} /></div>
                <div className="field field-switch">
                  <label className="switch-row">
                    <input type="checkbox" name="cameras_allowed" disabled={!canManageEntries || data.weekClosed} />
                    <span className="switch-ui" />
                    Permitir camara
                  </label>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea name="characteristics" placeholder="Caracteristicas" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea name="notes" placeholder="Notas" autoComplete="off" disabled={!canManageEntries || data.weekClosed} />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={devicePending} label="Guardar aparato" loadingLabel="Loading..." className="button" disabled={!canManageEntries || data.weekClosed} />
                </div>
              </form>
            </article>
          </div>
        ) : null}

        {tab === "cobranza" ? (
          <div className="module-grid" style={{ marginTop: "1rem" }}>
            <article className="data-card">
              <div className="actions-row" style={{ justifyContent: "space-between", marginBottom: "0.8rem" }}>
                <strong className="section-title">Cobranza por zona</strong>
                <button type="button" className="button-soft hide-print" onClick={() => window.print()}>
                  Imprimir registros
                </button>
              </div>
              <div className="field" style={{ marginBottom: "0.8rem" }}>
                <select value={selectedZoneFilter} onChange={(event) => setSelectedZoneFilter(event.target.value)}>
                  <option value="">Todas las zonas</option>
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="table-wrap compact-table">
                <table>
                  <thead>
                    <tr>
                      <th>Ubicacion</th>
                      <th>Interno</th>
                      <th>Dispositivos</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInternalsForZone.length === 0 ? (
                      <tr><td colSpan={4}>Sin internos para esta zona.</td></tr>
                    ) : (
                      filteredInternalsForZone.map((item) => (
                        <tr key={item.internalId}>
                          <td>{item.internalLocation}</td>
                          <td>{item.internalName}</td>
                          <td>{item.devices.map((device) => `${device.quantity} ${device.deviceTypeName}`).join(", ")}</td>
                          <td>${item.totalDue.toFixed(2)}</td>
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
              <form action={paymentAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <input type="hidden" name="amount" value={selectedChargeInternal?.totalDue ?? 0} />
                <div className="field">
                  <select
                    name="internal_id"
                    value={selectedChargeInternalId}
                    onChange={(event) => setSelectedChargeInternalId(event.target.value)}
                    disabled={!canManageCharges || data.weekClosed}
                  >
                    <option value="" disabled>Interno</option>
                    {filteredInternalsForZone.map((internal) => (
                      <option key={internal.internalId} value={internal.internalId}>
                        {internal.internalLocation} - {internal.internalName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="zone_id" defaultValue={selectedZoneFilter} disabled={!canManageCharges || data.weekClosed}>
                    <option value="">Zona</option>
                    {data.zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <strong>Total a pagar</strong>
                    <div style={{ marginTop: "0.3rem", fontSize: "1.2rem", fontWeight: 800 }}>
                      ${selectedChargeInternal?.totalDue.toFixed(2) ?? "0.00"}
                    </div>
                    <div className="muted" style={{ marginTop: "0.5rem" }}>
                      {selectedChargeInternal
                        ? selectedChargeInternal.devices.map((device) => `${device.quantity} ${device.deviceTypeName}`).join(", ")
                        : "Selecciona un interno para ver sus aparatos."}
                    </div>
                  </div>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea name="notes" placeholder="Notas del pago" autoComplete="off" disabled={!canManageCharges || data.weekClosed} />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={paymentPending} label="Registrar pago" loadingLabel="Loading..." className="button" disabled={!canManageCharges || data.weekClosed || !selectedChargeInternal} />
                </div>
              </form>
            </article>
          </div>
        ) : null}
      </section>

      {selectedInternal ? (
        <div className="modal-backdrop" onClick={() => setSelectedInternalId(null)}>
          <div className="form-card compact" style={{ width: "min(100%, 980px)" }} onClick={(event) => event.stopPropagation()}>
            <div className="profile-top">
              <div className="record-title">
                <strong className="section-title">{selectedInternal.internalName}</strong>
                <span>Ubicacion {selectedInternal.internalLocation}</span>
              </div>
              <button type="button" className="button-soft" onClick={() => setSelectedInternalId(null)}>Cerrar</button>
            </div>
            <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
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
                  {selectedInternal.devices.length === 0 ? (
                    <tr><td colSpan={4}>Sin aparatos visibles para este bloque.</td></tr>
                  ) : (
                    selectedInternal.devices.map((device) => (
                      <tr key={device.id}>
                        <td>{`${device.quantity} ${device.deviceTypeName}`}</td>
                        <td>{[device.brand, device.model].filter(Boolean).join(" / ") || "Sin detalle"}</td>
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
