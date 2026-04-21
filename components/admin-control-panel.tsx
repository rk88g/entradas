"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createModuleZoneAction,
  createModuleChargeRouteAction,
  createWorkplaceAction,
  forceCloseUserSessionsAction,
  saveRolePermissionGrantAction,
  saveModulePriceAction,
  saveModuleSettingsAction,
  saveUserPermissionGrantAction,
  saveWorkplacePositionAction,
  updateModuleZoneSortOrderAction,
  updateInternalIdentityAction,
  updateAuthUserPasswordAction,
  updateVisitorIdentityAction
} from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { RemoteInternalSearchField } from "@/components/remote-internal-search-field";
import { RemoteVisitorSearchField } from "@/components/remote-visitor-search-field";
import {
  ActionAuditRecord,
  AdminUserRecord,
  ConnectionLogRecord,
  DangerZoneConfigData,
  InternalSearchOption,
  ModuleKey,
  MutationState,
  VisitorSearchOption
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

function formatEstimatedLocation(log: ConnectionLogRecord) {
  const parts = [log.city, log.region, log.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Sin dato";
}

export function AdminControlPanel({
  connectionLogs,
  actionLogs,
  users,
  config,
  adminConfigured
}: {
  connectionLogs: ConnectionLogRecord[];
  actionLogs: ActionAuditRecord[];
  users: AdminUserRecord[];
  config: DangerZoneConfigData;
  adminConfigured: boolean;
}) {
  const [tab, setTab] = useState<"sesiones" | "acciones" | "usuarios" | "configuracion" | "permisos" | "correcciones">("configuracion");
  const [selectedModuleForRoute, setSelectedModuleForRoute] = useState<ModuleKey>("visual");
  const [selectedModuleForPrice, setSelectedModuleForPrice] = useState<ModuleKey>("visual");
  const [selectedWorkplaceInternal, setSelectedWorkplaceInternal] = useState<InternalSearchOption | null>(null);
  const [selectedCorrectionInternal, setSelectedCorrectionInternal] = useState<InternalSearchOption | null>(null);
  const [selectedCorrectionVisitor, setSelectedCorrectionVisitor] = useState<VisitorSearchOption | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [internalNamesForm, setInternalNamesForm] = useState({
    nombres: "",
    apellidoPat: "",
    apellidoMat: "",
    ubicacion: ""
  });
  const [visitorNameForm, setVisitorNameForm] = useState({
    nombreCompleto: ""
  });
  const [passwordState, passwordAction, passwordPending] = useActionState(updateAuthUserPasswordAction, mutationInitialState);
  const [forceState, forceAction, forcePending] = useActionState(forceCloseUserSessionsAction, mutationInitialState);
  const [rolePermissionState, rolePermissionAction, rolePermissionPending] = useActionState(saveRolePermissionGrantAction, mutationInitialState);
  const [userPermissionState, userPermissionAction, userPermissionPending] = useActionState(saveUserPermissionGrantAction, mutationInitialState);
  const [internalIdentityState, internalIdentityAction, internalIdentityPending] = useActionState(updateInternalIdentityAction, mutationInitialState);
  const [visitorIdentityState, visitorIdentityAction, visitorIdentityPending] = useActionState(updateVisitorIdentityAction, mutationInitialState);
  const [cutoffState, cutoffAction, cutoffPending] = useActionState(saveModuleSettingsAction, mutationInitialState);
  const [zoneState, zoneAction, zonePending] = useActionState(createModuleZoneAction, mutationInitialState);
  const [zoneSortState, zoneSortAction, zoneSortPending] = useActionState(updateModuleZoneSortOrderAction, mutationInitialState);
  const [routeState, routeAction, routePending] = useActionState(createModuleChargeRouteAction, mutationInitialState);
  const [priceState, priceAction, pricePending] = useActionState(saveModulePriceAction, mutationInitialState);
  const [workplaceState, workplaceAction, workplacePending] = useActionState(createWorkplaceAction, mutationInitialState);
  const [positionState, positionAction, positionPending] = useActionState(saveWorkplacePositionAction, mutationInitialState);

  const filteredDeviceTypes = useMemo(
    () => config.deviceTypes.filter((item) => item.moduleKey === selectedModuleForPrice),
    [config.deviceTypes, selectedModuleForPrice]
  );
  const assignableScopes = useMemo(
    () => config.permissionScopes.filter((scope) => !scope.key.startsWith("danger-zone")),
    [config.permissionScopes]
  );

  useEffect(() => {
    if (positionState.success) {
      setSelectedWorkplaceInternal(null);
    }
  }, [positionState.success]);

  useEffect(() => {
    if (!selectedCorrectionInternal) {
      setInternalNamesForm({
        nombres: "",
        apellidoPat: "",
        apellidoMat: "",
        ubicacion: ""
      });
      return;
    }

    setInternalNamesForm({
      nombres: selectedCorrectionInternal.nombres,
      apellidoPat: selectedCorrectionInternal.apellidoPat,
      apellidoMat: selectedCorrectionInternal.apellidoMat,
      ubicacion: selectedCorrectionInternal.ubicacion
    });
  }, [selectedCorrectionInternal]);

  useEffect(() => {
    setVisitorNameForm({
      nombreCompleto: selectedCorrectionVisitor?.fullName ?? ""
    });
  }, [selectedCorrectionVisitor]);

  useEffect(() => {
    if (internalIdentityState.success) {
      setSelectedCorrectionInternal(null);
    }
  }, [internalIdentityState.success]);

  useEffect(() => {
    if (visitorIdentityState.success) {
      setSelectedCorrectionVisitor(null);
    }
  }, [visitorIdentityState.success]);

  return (
    <section className="module-panel danger-zone-panel">
      <div className="admin-tabstrip" role="tablist" aria-label="Secciones de Danger Zone">
        {[
          { key: "configuracion", label: "Configuracion" },
          { key: "usuarios", label: "Usuarios" },
          { key: "correcciones", label: "Correcciones" },
          { key: "permisos", label: "Permisos" },
          { key: "sesiones", label: "Sesiones" },
          { key: "acciones", label: "Acciones" }
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`admin-tab ${tab === item.key ? "active" : ""}`}
            onClick={() => setTab(item.key as typeof tab)}
          >
            <span className="admin-tab-label">{item.label}</span>
          </button>
        ))}
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
                <MutationBanner state={zoneSortState} />
                <form action={zoneAction} className="field-grid" autoComplete="off">
                <div className="field">
                  <input name="name" placeholder="Codigo de zona, por ejemplo M8" autoComplete="off" />
                </div>
                <div className="field">
                  <input name="sort_order" type="number" min={1} placeholder="Orden" autoComplete="off" />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={zonePending} label="Guardar zona" loadingLabel="Loading..." className="button-secondary" />
                </div>
                </form>

                <div className="table-wrap compact-table responsive-mobile-table" style={{ marginTop: "0.8rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Zona</th>
                        <th>Activo</th>
                        <th>Guardar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.zones.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Sin zonas.</td>
                        </tr>
                      ) : (
                        config.zones.map((zone) => (
                          <tr key={zone.id}>
                            <td colSpan={4} style={{ padding: 0, border: "none" }}>
                              <form action={zoneSortAction} className="admin-table-row-form" autoComplete="off">
                                <input type="hidden" name="zone_id" value={zone.id} />
                                <div data-label="Orden">
                                  <input
                                    name="sort_order"
                                    type="number"
                                    min={1}
                                    defaultValue={zone.sortOrder}
                                    style={{ width: "6rem" }}
                                  />
                                </div>
                                <div data-label="Zona">{zone.name}</div>
                                <div data-label="Activo">{zone.active ? "Si" : "No"}</div>
                                <div data-label="Guardar">
                                  <LoadingButton
                                    pending={zoneSortPending}
                                    label="Guardar"
                                    loadingLabel="Loading..."
                                    className="button-soft"
                                  />
                                </div>
                              </form>
                            </td>
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

              <div className="table-wrap compact-table responsive-mobile-table" style={{ marginTop: "0.8rem" }}>
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
                          <td data-label="Bloque">{route.moduleKey}</td>
                          <td data-label="Zona">{route.zoneName}</td>
                          <td data-label="Dia">{weekdayOptions.find((item) => Number(item.value) === route.chargeWeekday)?.label ?? route.chargeWeekday}</td>
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

              <div className="table-wrap compact-table responsive-mobile-table" style={{ marginTop: "0.8rem" }}>
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
                          <td data-label="Bloque">{price.moduleKey}</td>
                          <td data-label="Aparato">{price.deviceTypeName}</td>
                          <td data-label="Semanal">${price.weeklyPrice.toFixed(2)}</td>
                          <td data-label="Alta">${price.activationPrice.toFixed(2)}</td>
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
              <RemoteInternalSearchField
                name="assigned_internal_id"
                selected={selectedWorkplaceInternal}
                onSelect={setSelectedWorkplaceInternal}
                placeholder="Buscar interno o dejar vacante"
                showEmptySelection
              />
              <div className="actions-row">
                <LoadingButton pending={positionPending} label="Guardar puesto" loadingLabel="Loading..." className="button-secondary" />
              </div>
              </form>

              <div className="table-wrap compact-table responsive-mobile-table" style={{ marginTop: "0.8rem" }}>
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
                          <td data-label="Centro">{position.workplaceName}</td>
                          <td data-label="Puesto">{position.title}</td>
                          <td data-label="Sueldo">${position.salary.toFixed(2)}</td>
                          <td data-label="Interno">{position.assignedInternalName ?? "Vacante"}</td>
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
              <MutationBanner state={forceState} />
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
                <div className="password-field-row">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nueva contrasena"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="button-soft password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
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
              <div className="table-wrap compact-table responsive-mobile-table">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Perfil</th>
                    <th>Seguridad</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Sin usuarios.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td data-label="Usuario">{user.fullName}</td>
                        <td data-label="Correo">{user.email || "-"}</td>
                        <td data-label="Rol">{user.roleKey}</td>
                        <td data-label="Perfil">{user.hasProfile ? "Listo" : "Sin perfil"}</td>
                        <td data-label="Seguridad">
                          {user.roleKey === "super-admin" ? (
                            <span className="status-pill warning">Protegido</span>
                          ) : (
                            <form action={forceAction}>
                              <input type="hidden" name="user_id" value={user.id} />
                              <LoadingButton
                                pending={forcePending}
                                label="Cerrar sesiones"
                                loadingLabel="Loading..."
                                className="button-secondary"
                                disabled={!adminConfigured}
                              />
                            </form>
                          )}
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
      ) : null}

      {tab === "permisos" ? (
        <section className="collapse-stack" style={{ marginTop: "1rem" }}>
          <details className="data-card section-collapse">
            <summary>
              <span>Permisos por rol</span>
              <span>{config.rolePermissionGrants.length} registros</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={rolePermissionState} />
              <form action={rolePermissionAction} className="field-grid" autoComplete="off">
                <div className="field">
                  <select name="role_id" defaultValue="">
                    <option value="" disabled>Rol</option>
                    {config.roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="scope_key" defaultValue="">
                    <option value="" disabled>Modulo o seccion</option>
                    {assignableScopes.map((scope) => (
                      <option key={scope.key} value={scope.key}>
                        {scope.scopeType === "section" ? `${scope.label} (${scope.key})` : scope.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="access_level" defaultValue="manage">
                    <option value="inherit">Heredar</option>
                    <option value="none">Ocultar</option>
                    <option value="view">Solo ver</option>
                    <option value="manage">Gestionar</option>
                  </select>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={rolePermissionPending} label="Guardar permiso de rol" loadingLabel="Loading..." className="button" />
                </div>
              </form>

              <div className="table-wrap compact-table responsive-mobile-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th>Alcance</th>
                      <th>Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.rolePermissionGrants.length === 0 ? (
                      <tr><td colSpan={3}>Sin permisos por rol.</td></tr>
                    ) : (
                      config.rolePermissionGrants.map((grant) => (
                        <tr key={grant.id}>
                          <td data-label="Rol">{grant.subjectLabel}</td>
                          <td data-label="Alcance">{config.permissionScopes.find((scope) => scope.key === grant.scopeKey)?.label ?? grant.scopeKey}</td>
                          <td data-label="Nivel">{grant.accessLevel}</td>
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
              <span>Permisos por usuario</span>
              <span>{config.userPermissionGrants.length} registros</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={userPermissionState} />
              <form action={userPermissionAction} className="field-grid" autoComplete="off">
                <div className="field">
                  <select name="user_id" defaultValue="">
                    <option value="" disabled>Usuario</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.fullName} - {user.roleKey}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="scope_key" defaultValue="">
                    <option value="" disabled>Modulo o seccion</option>
                    {assignableScopes.map((scope) => (
                      <option key={scope.key} value={scope.key}>
                        {scope.scopeType === "section" ? `${scope.label} (${scope.key})` : scope.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <select name="access_level" defaultValue="manage">
                    <option value="inherit">Heredar</option>
                    <option value="none">Ocultar</option>
                    <option value="view">Solo ver</option>
                    <option value="manage">Gestionar</option>
                  </select>
                </div>
                <div className="actions-row">
                  <LoadingButton pending={userPermissionPending} label="Guardar permiso de usuario" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>

              <div className="table-wrap compact-table responsive-mobile-table" style={{ marginTop: "0.8rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Alcance</th>
                      <th>Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.userPermissionGrants.length === 0 ? (
                      <tr><td colSpan={3}>Sin permisos por usuario.</td></tr>
                    ) : (
                      config.userPermissionGrants.map((grant) => (
                        <tr key={grant.id}>
                          <td data-label="Usuario">{grant.subjectLabel}</td>
                          <td data-label="Alcance">{config.permissionScopes.find((scope) => scope.key === grant.scopeKey)?.label ?? grant.scopeKey}</td>
                          <td data-label="Nivel">{grant.accessLevel}</td>
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

      {tab === "correcciones" ? (
        <section className="collapse-stack" style={{ marginTop: "1rem" }}>
          <details className="data-card section-collapse">
            <summary>
              <span>Corregir interno</span>
              <span>Nombre y ubicacion</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={internalIdentityState} />
              <form action={internalIdentityAction} className="field-grid" autoComplete="off">
                <RemoteInternalSearchField
                  name="interno_id"
                  selected={selectedCorrectionInternal}
                  onSelect={setSelectedCorrectionInternal}
                  placeholder="Buscar interno por nombre o ubicacion"
                />
                <div className="field">
                  <input
                    name="nombres"
                    placeholder="Nombres"
                    autoComplete="off"
                    value={internalNamesForm.nombres}
                    onChange={(event) =>
                      setInternalNamesForm((current) => ({ ...current, nombres: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <input
                    name="apellido_pat"
                    placeholder="Apellido paterno"
                    autoComplete="off"
                    value={internalNamesForm.apellidoPat}
                    onChange={(event) =>
                      setInternalNamesForm((current) => ({ ...current, apellidoPat: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <input
                    name="apellido_mat"
                    placeholder="Apellido materno"
                    autoComplete="off"
                    value={internalNamesForm.apellidoMat}
                    onChange={(event) =>
                      setInternalNamesForm((current) => ({ ...current, apellidoMat: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <input
                    name="ubicacion"
                    placeholder="Ubicacion 1-101 o I-00"
                    autoComplete="off"
                    value={internalNamesForm.ubicacion}
                    onChange={(event) =>
                      setInternalNamesForm((current) => ({ ...current, ubicacion: event.target.value }))
                    }
                  />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={internalIdentityPending} label="Guardar interno" loadingLabel="Loading..." className="button" />
                </div>
              </form>
            </div>
          </details>

          <details className="data-card section-collapse">
            <summary>
              <span>Corregir visita</span>
              <span>Nombre completo</span>
            </summary>
            <div className="section-collapse-body">
              <MutationBanner state={visitorIdentityState} />
              <form action={visitorIdentityAction} className="field-grid" autoComplete="off">
                <RemoteVisitorSearchField
                  name="visita_id"
                  selected={selectedCorrectionVisitor}
                  onSelect={setSelectedCorrectionVisitor}
                  placeholder="Buscar visita por nombre"
                />
                <div className="field">
                  <input
                    name="nombreCompleto"
                    placeholder="Nombre completo"
                    autoComplete="off"
                    value={visitorNameForm.nombreCompleto}
                    onChange={(event) =>
                      setVisitorNameForm({ nombreCompleto: event.target.value })
                    }
                  />
                </div>
                <div className="actions-row">
                  <LoadingButton pending={visitorIdentityPending} label="Guardar visita" loadingLabel="Loading..." className="button-secondary" />
                </div>
              </form>
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
            <div className="table-wrap compact-table responsive-mobile-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Resultado</th>
                  <th>IP</th>
                  <th>Ubicacion estimada</th>
                </tr>
              </thead>
              <tbody>
                {connectionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Sin logs.</td>
                  </tr>
                ) : (
                  connectionLogs.map((log) => (
                    <tr key={log.id}>
                      <td data-label="Fecha">{formatDateTime(log.createdAt)}</td>
                      <td data-label="Usuario">{log.userName ?? "-"}</td>
                      <td data-label="Correo">{log.email}</td>
                      <td data-label="Resultado">{log.success ? "Correcto" : log.failureReason ?? "Fallido"}</td>
                      <td data-label="IP">{log.ipAddress ?? "-"}</td>
                      <td data-label="Ubicacion">{formatEstimatedLocation(log)}</td>
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
            <div className="table-wrap compact-table responsive-mobile-table">
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
                      <td data-label="Fecha">{formatDateTime(log.createdAt)}</td>
                      <td data-label="Usuario">{log.userName ?? "-"}</td>
                      <td data-label="Modulo">{log.moduleKey}</td>
                      <td data-label="Seccion">{log.sectionKey}</td>
                      <td data-label="Accion">{log.actionKey}</td>
                      <td data-label="Elemento">{`${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}`}</td>
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
