"use client";

import { useActionState, useMemo, useState } from "react";
import {
  assignModuleDeviceAction,
  assignModuleStaffAction,
  assignModuleWorkerAction,
  closeModuleWeekAction,
  createModuleZoneAction,
  registerModulePaymentAction,
  saveModulePriceAction,
  saveModuleSettingsAction
} from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import {
  InternalDeviceRecord,
  ModuleAccess,
  ModulePanelData,
  ModuleWorkerFunctionKey,
  MutationState,
  RoleKey
} from "@/lib/types";
import { canManageModuleFunction, compareInternalLocations } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

type ModuleTab = "resumen" | "aparatos" | "cobranza" | "configuracion";

const workerFunctions: Array<{ key: ModuleWorkerFunctionKey; label: string }> = [
  { key: "encargado", label: "Encargado" },
  { key: "segundo", label: "Segundo" },
  { key: "supervisor", label: "Supervisor" },
  { key: "altas", label: "Altas" },
  { key: "cobranza", label: "Cobranza" },
  { key: "mantenimiento", label: "Mantenimiento" }
];

const weekdayOptions = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miercoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sabado" },
  { value: "0", label: "Domingo" }
];

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

function getDeviceWeeklyCharge(device: InternalDeviceRecord, priceMap: Map<string, { weeklyPrice: number; discountAmount: number }>) {
  const configured = priceMap.get(device.deviceTypeId);
  const baseAmount =
    device.weeklyPriceOverride ?? configured?.weeklyPrice ?? 0;
  const discount =
    device.discountOverride ?? configured?.discountAmount ?? 0;

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
  const [selectedChargeInternalId, setSelectedChargeInternalId] = useState<string>("");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("");
  const [zoneState, zoneAction, zonePending] = useActionState(createModuleZoneAction, mutationInitialState);
  const [priceState, priceAction, pricePending] = useActionState(saveModulePriceAction, mutationInitialState);
  const [deviceState, deviceAction, devicePending] = useActionState(assignModuleDeviceAction, mutationInitialState);
  const [paymentState, paymentAction, paymentPending] = useActionState(registerModulePaymentAction, mutationInitialState);
  const [workerState, workerAction, workerPending] = useActionState(assignModuleWorkerAction, mutationInitialState);
  const [staffState, staffAction, staffPending] = useActionState(assignModuleStaffAction, mutationInitialState);
  const [settingsState, settingsAction, settingsPending] = useActionState(saveModuleSettingsAction, mutationInitialState);
  const [closeState, closeAction, closePending] = useActionState(closeModuleWeekAction, mutationInitialState);

  const visibleDeviceTypes = data.deviceTypes;

  const priceMap = useMemo(
    () =>
      new Map(
        data.prices.map((item) => [
          item.deviceTypeId,
          { weeklyPrice: item.weeklyPrice, discountAmount: item.discountAmount }
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
        paidCount: number;
        pendingCount: number;
      }
    >();

    data.devices.forEach((device) => {
      const current = map.get(device.internalId) ?? {
        internalId: device.internalId,
        internalName: device.internalName,
        internalLocation: device.internalLocation,
        devices: [],
        totalDue: 0,
        paidCount: 0,
        pendingCount: 0
      };
      current.devices.push(device);
      current.totalDue += getDeviceWeeklyCharge(device, priceMap);
      if (data.paidDevices.some((paid) => paid.id === device.id)) {
        current.paidCount += 1;
      } else if (device.status === "activo") {
        current.pendingCount += 1;
      }
      map.set(device.internalId, current);
    });

    return [...map.values()].sort((a, b) => compareInternalLocations(a.internalLocation, b.internalLocation));
  }, [data.devices, data.paidDevices, priceMap]);

  const filteredInternalsForZone = groupedInternals.filter((item) => {
    if (!selectedZoneFilter) {
      return true;
    }

    const zone = data.zones.find((entry) => entry.id === selectedZoneFilter);
    if (!zone) {
      return true;
    }

    return item.devices.some(
      (device) =>
        device.zoneId === zone.id ||
        matchesZoneByLocation(zone.name, item.internalLocation)
    );
  });

  const selectedInternal = groupedInternals.find((item) => item.internalId === selectedInternalId) ?? null;
  const selectedChargeInternal =
    filteredInternalsForZone.find((item) => item.internalId === selectedChargeInternalId) ?? null;
  const visibleModalDevices = selectedInternal?.devices ?? [];

  const canManageConfig = roleKey === "super-admin";
  const canManageCharges = canManageModuleFunction(roleKey, accesses, data.moduleKey, "cobranza");
  const canManageEntries = canManageModuleFunction(roleKey, accesses, data.moduleKey, "altas");
  const canCloseWeek =
    roleKey === "super-admin" ||
    canManageModuleFunction(roleKey, accesses, data.moduleKey, "encargado");

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
          {canManageConfig ? (
            <button
              type="button"
              className={`button-secondary listing-toggle ${tab === "configuracion" ? "active" : ""}`}
              onClick={() => setTab("configuracion")}
            >
              Configuracion
            </button>
          ) : null}
        </div>

        {tab === "resumen" ? (
          <div className="stack" style={{ marginTop: "1rem" }}>
            {data.unpaidDevices.length > 0 ? (
              <div className="alert-box">
                {data.unpaidDevices.length} aparatos sin pago semanal en {data.moduleName}.
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
                <small>Pendientes</small>
                <strong>{data.unpaidDevices.length}</strong>
              </article>
              <article className="stat-card">
                <small>Mantenimiento</small>
                <strong>{data.devices.filter((item) => item.status === "reparacion").length}</strong>
              </article>
              <article className="stat-card">
                <small>Retenidos</small>
                <strong>{data.devices.filter((item) => item.status === "retenido").length}</strong>
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
                    <th>Zona</th>
                    <th>Pagados</th>
                    <th>Pendientes</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totalsByZone.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sin datos de zonas.</td>
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

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Interno</th>
                    <th>Ubicacion</th>
                    <th>Aparatos</th>
                    <th>Total semanal</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedInternals.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sin aparatos registrados.</td>
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
                        <td>${item.totalDue.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {canCloseWeek && data.currentCycleId ? (
              <div className="form-card">
                <strong className="section-title">Cierre de semana</strong>
                <MutationBanner state={closeState} />
                <form action={closeAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                  <input type="hidden" name="module_key" value={data.moduleKey} />
                  <input type="hidden" name="cycle_id" value={data.currentCycleId} />
                  <div className="actions-row">
                  <LoadingButton pending={closePending} label="Cerrar semana" loadingLabel="Loading..." className="button" disabled={data.weekClosed} />
                  </div>
                </form>
              </div>
            ) : null}
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
                      <th>Ubicacion</th>
                      <th>Aparato</th>
                      <th>Zona</th>
                      <th>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devices.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Sin aparatos.</td>
                      </tr>
                    ) : (
                      data.devices.map((device) => (
                        <tr key={device.id}>
                          <td>{device.internalName}</td>
                          <td>{device.internalLocation}</td>
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
                    {visibleDeviceTypes.map((deviceType) => (
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
              <div className="actions-row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
                <strong className="section-title">Cobranza por zona</strong>
                <button type="button" className="button-soft hide-print" onClick={() => window.print()}>
                  Imprimir registros
                </button>
              </div>

              <div className="field" style={{ marginBottom: "1rem" }}>
                <select value={selectedZoneFilter} onChange={(event) => setSelectedZoneFilter(event.target.value)}>
                  <option value="">Todas las zonas</option>
                  {data.zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="table-wrap">
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
                      <tr>
                        <td colSpan={4}>Sin internos en esta zona.</td>
                      </tr>
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
              <form action={paymentAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <input type="hidden" name="amount" value={selectedChargeInternal?.totalDue ?? 0} />
                <div className="field">
                  <select
                    name="internal_id"
                    value={selectedChargeInternalId}
                    onChange={(event) => setSelectedChargeInternalId(event.target.value)}
                    required
                    disabled={!canManageCharges || data.weekClosed}
                  >
                    <option value="" disabled>
                      Interno
                    </option>
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
                    <div style={{ marginTop: "0.35rem", fontSize: "1.2rem", fontWeight: 800 }}>
                      ${selectedChargeInternal?.totalDue.toFixed(2) ?? "0.00"}
                    </div>
                    <div className="muted" style={{ marginTop: "0.5rem" }}>
                      {selectedChargeInternal
                        ? selectedChargeInternal.devices
                            .map((device) => `${device.quantity} ${device.deviceTypeName}`)
                            .join(", ")
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

        {tab === "configuracion" && canManageConfig ? (
          <div className="module-grid" style={{ marginTop: "1rem" }}>
            <article className="form-card">
              <strong className="section-title">Corte, zonas y precios</strong>
              <MutationBanner state={settingsState} />
              <form action={settingsAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="cutoff_weekday" defaultValue={String(data.cutoffWeekday)}>
                    {weekdayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={settingsPending} label="Guardar corte" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <MutationBanner state={zoneState} />
              <form action={zoneAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <input name="name" placeholder="Zona" autoComplete="off" />
                </div>
                <div className="field">
                  <select name="charge_weekday" defaultValue={String(data.cutoffWeekday)}>
                    {weekdayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={zonePending} label="Guardar zona" loadingLabel="Loading..." className="button-secondary" disabled={data.weekClosed} />
                </div>
              </form>

              <MutationBanner state={priceState} />
              <form action={priceAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="device_type_id" defaultValue="" required disabled={data.weekClosed}>
                    <option value="" disabled>
                      Aparato
                    </option>
                    {visibleDeviceTypes.map((deviceType) => (
                      <option key={deviceType.id} value={deviceType.id}>
                        {deviceType.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <input name="weekly_price" type="number" step="0.01" placeholder="Precio semanal" autoComplete="off" disabled={data.weekClosed} />
                </div>
                <div className="field">
                  <input name="discount_amount" type="number" step="0.01" placeholder="Descuento" autoComplete="off" disabled={data.weekClosed} />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={pricePending} label="Guardar precio" loadingLabel="Loading..." className="button-secondary" disabled={data.weekClosed} />
                </div>
              </form>
            </article>

            <article className="form-card">
              <strong className="section-title">Trabajadores y puestos</strong>
              <MutationBanner state={workerState} />
              <form action={workerAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="user_id" defaultValue="">
                    <option value="" disabled>
                      Usuario del bloque
                    </option>
                    {data.assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <strong>Puestos</strong>
                  <div className="article-grid">
                    {workerFunctions.map((fn) => (
                      <label key={fn.key}>
                        <input type="checkbox" name="functions" value={fn.key} /> {fn.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>
                    <input type="checkbox" name="module_only" /> Solo vera este bloque
                  </label>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={workerPending} label="Guardar trabajador" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <MutationBanner state={staffState} />
              <form action={staffAction} className="field-grid" style={{ marginTop: "1rem" }} autoComplete="off">
                <input type="hidden" name="module_key" value={data.moduleKey} />
                <div className="field">
                  <select name="internal_id" defaultValue="">
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
                  <select name="user_id" defaultValue="">
                    <option value="" disabled>
                      Usuario
                    </option>
                    {data.assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="position_key" defaultValue="">
                    <option value="" disabled>
                      Puesto
                    </option>
                    {workerFunctions.map((fn) => (
                      <option key={fn.key} value={fn.key}>
                        {fn.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={staffPending} label="Guardar puesto" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Puestos</th>
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
                          <td>{worker.functions.join(", ") || "Sin puestos"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Interno</th>
                      <th>Usuario</th>
                      <th>Puesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staffAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={3}>Sin asignaciones.</td>
                      </tr>
                    ) : (
                      data.staffAssignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>{assignment.internalName}</td>
                          <td>{assignment.userName}</td>
                          <td>{assignment.positionKey}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
