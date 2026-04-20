"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createModuleZoneAction,
  createModuleChargeRouteAction,
  createWorkplaceAction,
  saveModulePriceAction,
  saveModuleSettingsAction,
  saveWorkplacePositionAction,
  updateAuthUserPasswordAction
} from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import {
  ActionAuditRecord,
  AdminUserRecord,
  ConnectionLogRecord,
  DangerZoneConfigData,
  ModuleKey,
  MutationState
} from "@/lib/types";
import { formatLongDate } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

const weekdayOptions = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miercoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sabado" },
  { value: "0", label: "Domingo" }
];

const moduleOptions: Array<{ value: ModuleKey; label: string }> = [
  { value: "visual", label: "Visual" },
  { value: "comunicacion", label: "Comunicacion" },
  { value: "escaleras", label: "Escaleras" },
  { value: "rentas", label: "Rentas" }
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatLongDate(value.slice(0, 10))} ${date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function AdminControlPanel({
  connectionLogs,
  actionLogs,
  users,
  config,
  internals,
  adminConfigured
}: {
  connectionLogs: ConnectionLogRecord[];
  actionLogs: ActionAuditRecord[];
  users: AdminUserRecord[];
  config: DangerZoneConfigData;
  internals: Array<{ id: string; fullName: string; ubicacion: string }>;
  adminConfigured: boolean;
}) {
  const [tab, setTab] = useState<"sesiones" | "acciones" | "usuarios" | "configuracion">("configuracion");
  const [selectedModuleForRoute, setSelectedModuleForRoute] = useState<ModuleKey>("visual");
  const [selectedModuleForPrice, setSelectedModuleForPrice] = useState<ModuleKey>("visual");
  const [workplaceInternalSearch, setWorkplaceInternalSearch] = useState("");
  const [selectedWorkplaceInternalId, setSelectedWorkplaceInternalId] = useState("");
  const [passwordState, passwordAction, passwordPending] = useActionState(updateAuthUserPasswordAction, mutationInitialState);
  const [cutoffState, cutoffAction, cutoffPending] = useActionState(saveModuleSettingsAction, mutationInitialState);
  const [zoneState, zoneAction, zonePending] = useActionState(createModuleZoneAction, mutationInitialState);
  const [routeState, routeAction, routePending] = useActionState(createModuleChargeRouteAction, mutationInitialState);
  const [priceState, priceAction, pricePending] = useActionState(saveModulePriceAction, mutationInitialState);
  const [workplaceState, workplaceAction, workplacePending] = useActionState(createWorkplaceAction, mutationInitialState);
  const [positionState, positionAction, positionPending] = useActionState(saveWorkplacePositionAction, mutationInitialState);

  const filteredDeviceTypes = useMemo(
    () => config.deviceTypes.filter((item) => item.moduleKey === selectedModuleForPrice),
    [config.deviceTypes, selectedModuleForPrice]
  );
  const filteredInternals = useMemo(() => {
    const normalized = workplaceInternalSearch.trim().toLowerCase();
    if (!normalized) {
      return internals;
    }

    return internals.filter((internal) => (
      internal.fullName.toLowerCase().includes(normalized) ||
      internal.ubicacion.toLowerCase().includes(normalized)
    ));
  }, [internals, workplaceInternalSearch]);

  return (
    <section className="module-panel danger-zone-panel">
      <div className="toolbar">
        <button type="button" className={`button-secondary listing-toggle ${tab === "configuracion" ? "active" : ""}`} onClick={() => setTab("configuracion")}>
          Configuracion
        </button>
        <button type="button" className={`button-secondary listing-toggle ${tab === "usuarios" ? "active" : ""}`} onClick={() => setTab("usuarios")}>
          Usuarios
        </button>
        <button type="button" className={`button-secondary listing-toggle ${tab === "sesiones" ? "active" : ""}`} onClick={() => setTab("sesiones")}>
          Sesiones
        </button>
        <button type="button" className={`button-secondary listing-toggle ${tab === "acciones" ? "active" : ""}`} onClick={() => setTab("acciones")}>
          Acciones
        </button>
      </div>

      {tab === "configuracion" ? (
        <section className="collapse-stack" style={{ marginTop: "1rem" }}>
          <details className="data-card section-collapse">
            <summary>
              <span>Corte global</span>
              <span>Configuracion general</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={cutoffState} />
              <form action={cutoffAction} className="field-grid" autoComplete="off">
              <div className="field">
                <select name="cutoff_weekday" defaultValue={String(config.cutoffWeekday)}>
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="actions-row">
                <LoadingButton pending={cutoffPending} label="Guardar corte" loadingLabel="Loading..." className="button" />
              </div>
              </form>
            </div>
          </details>

          <details className="data-card section-collapse">
            <summary>
              <span>Zonas</span>
              <span>{config.zones.length} registros</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={zoneState} />
              <form action={zoneAction} className="field-grid" autoComplete="off">
              <div className="field">
                <input name="name" placeholder="Codigo de zona, por ejemplo M8" autoComplete="off" />
              </div>
              <div className="actions-row">
                <LoadingButton pending={zonePending} label="Guardar zona" loadingLabel="Loading..." className="button-secondary" />
              </div>
              </form>

              <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Zona</th>
                      <th>Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.zones.length === 0 ? (
                      <tr>
                        <td colSpan={2}>Sin zonas.</td>
                      </tr>
                    ) : (
                      config.zones.map((zone) => (
                        <tr key={zone.id}>
                          <td>{zone.name}</td>
                          <td>{zone.active ? "Si" : "No"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <details className="data-card section-collapse">
            <summary>
              <span>Programacion de cobranza</span>
              <span>{config.chargeRoutes.length} registros</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={routeState} />
              <form action={routeAction} className="field-grid" autoComplete="off">
                <div className="field">
                  <select
                    name="module_key"
                    value={selectedModuleForRoute}
                    onChange={(event) => setSelectedModuleForRoute(event.target.value as ModuleKey)}
                  >
                    {moduleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="zone_id" defaultValue="">
                    <option value="" disabled>
                      Zona
                    </option>
                    {config.zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="charge_weekday" defaultValue={String(config.cutoffWeekday)}>
                    {weekdayOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={routePending} label="Guardar programacion" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bloque</th>
                      <th>Zona</th>
                      <th>Dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.chargeRoutes.length === 0 ? (
                      <tr>
                        <td colSpan={3}>Sin programaciones.</td>
                      </tr>
                    ) : (
                      config.chargeRoutes.map((route) => (
                        <tr key={route.id}>
                          <td>{route.moduleKey}</td>
                          <td>{route.zoneName}</td>
                          <td>{weekdayOptions.find((item) => Number(item.value) === route.chargeWeekday)?.label ?? route.chargeWeekday}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <details className="data-card section-collapse">
            <summary>
              <span>Lista de precios</span>
              <span>{config.prices.length} registros</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={priceState} />
              <form action={priceAction} className="field-grid" autoComplete="off">
                <div className="field">
                  <select
                    name="module_key"
                    value={selectedModuleForPrice}
                    onChange={(event) => setSelectedModuleForPrice(event.target.value as ModuleKey)}
                  >
                    {moduleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="device_type_id" defaultValue="">
                    <option value="" disabled>
                      Aparato
                    </option>
                    {filteredDeviceTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field"><input name="weekly_price" type="number" step="0.01" placeholder="Cuota semanal" autoComplete="off" /></div>
                <div className="field"><input name="activation_price" type="number" step="0.01" placeholder="Alta" autoComplete="off" /></div>
                <div className="field"><input name="fine_price" type="number" step="0.01" placeholder="Multa" autoComplete="off" /></div>
                <div className="field"><input name="maintenance_price" type="number" step="0.01" placeholder="Mantenimiento" autoComplete="off" /></div>
                <div className="field"><input name="retention_price" type="number" step="0.01" placeholder="Retencion" autoComplete="off" /></div>
                <div className="actions-row">
                  <LoadingButton pending={pricePending} label="Guardar precio" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bloque</th>
                      <th>Aparato</th>
                      <th>Semanal</th>
                      <th>Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.prices.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Sin precios.</td>
                      </tr>
                    ) : (
                      config.prices.map((price) => (
                        <tr key={price.id}>
                          <td>{price.moduleKey}</td>
                          <td>{price.deviceTypeName}</td>
                          <td>${price.weeklyPrice.toFixed(2)}</td>
                          <td>${price.activationPrice.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <details className="data-card section-collapse">
            <summary>
              <span>Negocios y oficinas</span>
              <span>{config.workplacePositions.length} puestos</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={workplaceState} />
              <form action={workplaceAction} className="field-grid" autoComplete="off">
              <div className="field"><input name="name" placeholder="Nombre del negocio u oficina" autoComplete="off" /></div>
              <div className="field">
                <select name="type" defaultValue="negocio">
                  <option value="negocio">Negocio</option>
                  <option value="oficina">Oficina</option>
                </select>
              </div>
              <div className="actions-row">
                <LoadingButton pending={workplacePending} label="Guardar centro" loadingLabel="Loading..." className="button-secondary" />
              </div>
              </form>

              <MutationBanner state={positionState} />
              <form action={positionAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
              <div className="field">
                <select name="workplace_id" defaultValue="">
                  <option value="" disabled>
                    Negocio u oficina
                  </option>
                  {config.workplaces.map((workplace) => (
                    <option key={workplace.id} value={workplace.id}>
                      {workplace.type} - {workplace.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field"><input name="title" placeholder="Puesto" autoComplete="off" /></div>
              <div className="field"><input name="salary" type="number" step="0.01" placeholder="Sueldo" autoComplete="off" /></div>
              <div className="field">
                <input
                  value={workplaceInternalSearch}
                  onChange={(event) => setWorkplaceInternalSearch(event.target.value)}
                  placeholder="Buscar interno o dejar vacante"
                  autoComplete="off"
                />
                <input type="hidden" name="assigned_internal_id" value={selectedWorkplaceInternalId} />
                <div className="inline-search-list">
                  <button
                    type="button"
                    className={`inline-search-item ${selectedWorkplaceInternalId === "" ? "active" : ""}`}
                    onClick={() => setSelectedWorkplaceInternalId("")}
                  >
                    <strong>Vacante</strong>
                  </button>
                  {filteredInternals.slice(0, 8).map((internal) => (
                    <button
                      key={internal.id}
                      type="button"
                      className={`inline-search-item ${selectedWorkplaceInternalId === internal.id ? "active" : ""}`}
                      onClick={() => setSelectedWorkplaceInternalId(internal.id)}
                    >
                      <strong>{internal.fullName}</strong>
                      <span className="muted">{internal.ubicacion}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="actions-row">
                <LoadingButton pending={positionPending} label="Guardar puesto" loadingLabel="Loading..." className="button-secondary" />
              </div>
              </form>

              <div className="table-wrap compact-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Centro</th>
                      <th>Puesto</th>
                      <th>Sueldo</th>
                      <th>Interno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.workplacePositions.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Sin puestos.</td>
                      </tr>
                    ) : (
                      config.workplacePositions.map((position) => (
                        <tr key={position.id}>
                          <td>{position.workplaceName}</td>
                          <td>{position.title}</td>
                          <td>${position.salary.toFixed(2)}</td>
                          <td>{position.assignedInternalName ?? "Vacante"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </section>
      ) : null}

      {tab === "usuarios" ? (
        <section className="collapse-stack" style={{ marginTop: "1rem" }}>
          <details className="data-card section-collapse">
            <summary>
              <span>Cambiar contrasena</span>
              <span>Control de acceso</span>
            </summary>
            <div className="section-collapse-body">
              {!adminConfigured ? <div className="alert-box">Falta configurar `SUPABASE_SERVICE_ROLE_KEY`.</div> : null}
              <MutationBanner state={passwordState} />
              <form action={passwordAction} className="field-grid" autoComplete="off">
              <div className="field">
                <select name="user_id" defaultValue="">
                  <option value="" disabled>
                    Usuario
                  </option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} - {user.roleKey} {user.email ? `- ${user.email}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <input name="password" type="password" placeholder="Nueva contrasena" autoComplete="off" />
              </div>
              <div className="actions-row">
                <LoadingButton pending={passwordPending} label="Actualizar contrasena" loadingLabel="Loading..." className="button" disabled={!adminConfigured} />
              </div>
              </form>
            </div>
          </details>

          <details className="data-card section-collapse">
            <summary>
              <span>Usuarios detectados</span>
              <span>{users.length} registros</span>
            </summary>
            <div className="section-collapse-body">
              <div className="table-wrap compact-table">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Perfil</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sin usuarios.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.fullName}</td>
                        <td>{user.email || "-"}</td>
                        <td>{user.roleKey}</td>
                        <td>{user.hasProfile ? "Listo" : "Sin perfil"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </details>
        </section>
      ) : null}

      {tab === "sesiones" ? (
        <details className="data-card section-collapse" style={{ marginTop: "1rem" }}>
          <summary>
            <span>Logs de conexion</span>
            <span>{connectionLogs.length} registros</span>
          </summary>
          <div className="section-collapse-body">
            <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Resultado</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {connectionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Sin logs.</td>
                  </tr>
                ) : (
                  connectionLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>{log.userName ?? "-"}</td>
                      <td>{log.email}</td>
                      <td>{log.success ? "Correcto" : log.failureReason ?? "Fallido"}</td>
                      <td>{log.ipAddress ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </details>
      ) : null}

      {tab === "acciones" ? (
        <details className="data-card section-collapse" style={{ marginTop: "1rem" }}>
          <summary>
            <span>Logs de acciones</span>
            <span>{actionLogs.length} registros</span>
          </summary>
          <div className="section-collapse-body">
            <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Modulo</th>
                  <th>Seccion</th>
                  <th>Accion</th>
                  <th>Elemento</th>
                </tr>
              </thead>
              <tbody>
                {actionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Sin logs.</td>
                  </tr>
                ) : (
                  actionLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.createdAt)}</td>
                      <td>{log.userName ?? "-"}</td>
                      <td>{log.moduleKey}</td>
                      <td>{log.sectionKey}</td>
                      <td>{log.actionKey}</td>
                      <td>{`${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}`}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
