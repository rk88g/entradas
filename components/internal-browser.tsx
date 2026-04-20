"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInternalAction,
  createPassAction,
  createVisitorAction,
  updateInternalStatusAction
} from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { DateRecord, InternalProfile, ModuleDeviceType, MutationState, RoleKey } from "@/lib/types";
import {
  canManageMentions,
  formatLongDate,
  getDefaultDateStatusForRole,
  getInternalStatusMeta,
  maskValue
} from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function getDateOptions(openDate?: DateRecord | null, nextDate?: DateRecord | null) {
  return [openDate, nextDate].filter((item): item is DateRecord => Boolean(item));
}

function getDefaultDateValue(roleKey: RoleKey, openDate?: DateRecord | null, nextDate?: DateRecord | null) {
  const preferredStatus = getDefaultDateStatusForRole(roleKey);
  if (preferredStatus === "proximo") {
    return nextDate?.fechaCompleta ?? openDate?.fechaCompleta ?? "";
  }

  return openDate?.fechaCompleta ?? nextDate?.fechaCompleta ?? "";
}

function getPassForDate(
  profile: InternalProfile,
  dateValue: string,
  openDate?: DateRecord | null,
  nextDate?: DateRecord | null
) {
  if (openDate?.fechaCompleta === dateValue) {
    return profile.openDatePass ?? null;
  }

  if (nextDate?.fechaCompleta === dateValue) {
    return profile.nextDatePass ?? null;
  }

  return profile.recentPasses.find((item) => item.fechaVisita === dateValue) ?? null;
}

function compactMoney(value?: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function getPassBadge(passExists: boolean) {
  return passExists ? (
    <StatusBadge variant="warn">Con pase</StatusBadge>
  ) : (
    <StatusBadge variant="ok">Sin pase</StatusBadge>
  );
}

export function InternalBrowser({
  profiles,
  nextDate,
  openDate,
  passArticles,
  roleKey
}: {
  profiles: InternalProfile[];
  nextDate?: DateRecord | null;
  openDate?: DateRecord | null;
  passArticles: ModuleDeviceType[];
  roleKey: RoleKey;
}) {
  const pageSize = 20;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modalInternalId, setModalInternalId] = useState<string | null>(null);
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<string[]>([]);
  const [selectedDateValue, setSelectedDateValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySections, setHistorySections] = useState<Record<string, boolean>>({});
  const [formSeed, setFormSeed] = useState(0);
  const [createState, createAction, createPending] = useActionState(createInternalAction, mutationInitialState);
  const [passState, passAction, passPending] = useActionState(createPassAction, mutationInitialState);
  const [visitorState, visitorAction, visitorPending] = useActionState(createVisitorAction, mutationInitialState);
  const [statusState, statusAction, statusPending] = useActionState(updateInternalStatusAction, mutationInitialState);
  const visitorFormRef = useRef<HTMLFormElement>(null);
  const internalFormRef = useRef<HTMLFormElement>(null);
  const canViewSensitiveData = roleKey === "super-admin";
  const canManageVisitorAvailability = roleKey === "super-admin" || roleKey === "control";

  const availableDates = useMemo(() => getDateOptions(openDate, nextDate), [openDate, nextDate]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return profiles;
    }

    return profiles.filter((profile) => {
      return (
        profile.fullName.toLowerCase().includes(normalized) ||
        profile.ubicacion.toLowerCase().includes(normalized)
      );
    });
  }, [profiles, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = profiles.find((item) => item.id === modalInternalId) ?? null;
  const selectedPass =
    selected && selectedDateValue
      ? getPassForDate(selected, selectedDateValue, openDate, nextDate)
      : null;
  const selectedVisitors =
    selected?.visitors.filter((item) => selectedVisitorIds.includes(item.visitaId)) ?? [];
  const availableVisitors =
    selected?.visitors.filter((item) => !selectedVisitorIds.includes(item.visitaId)) ?? [];
  const selectedAdults = selectedVisitors.filter((item) => item.visitor.edad >= 18);
  const canSubmitPass =
    Boolean(selected) &&
    Boolean(selectedDateValue) &&
    selectedVisitors.length > 0 &&
    selectedAdults.length > 0 &&
    !selectedPass;

  useEffect(() => {
    if (passState.success) {
      setModalInternalId(null);
    }
  }, [passState.success]);

  useEffect(() => {
    if (visitorState.success) {
      visitorFormRef.current?.reset();
      setFormSeed((current) => current + 1);
      router.refresh();
    }
  }, [router, visitorState.success]);

  useEffect(() => {
    if (createState.success) {
      internalFormRef.current?.reset();
    }
  }, [createState.success]);

  useEffect(() => {
    if (statusState.success) {
      router.refresh();
    }
  }, [router, statusState.success]);

  useEffect(() => {
    if (!modalInternalId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalInternalId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modalInternalId]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  function openInternalModal(profile: InternalProfile) {
    setModalInternalId(profile.id);
    setSelectedVisitorIds([]);
    setSelectedDateValue(getDefaultDateValue(roleKey, openDate, nextDate));
    setHistoryOpen(false);
    setHistorySections({});
    setFormSeed((current) => current + 1);
  }

  function toggleVisitor(visitaId: string) {
    setSelectedVisitorIds((current) =>
      current.includes(visitaId)
        ? current.filter((item) => item !== visitaId)
        : [...current, visitaId]
    );
  }

  function toggleHistorySection(sectionKey: string) {
    setHistorySections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  return (
    <>
      <section className="module-grid module-grid-single">
        <article className="data-card">
          <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <strong className="section-title">Internos</strong>
          </div>

          <div className="field" style={{ marginBottom: "0.8rem" }}>
            <input
              id="internal-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o ubicacion"
              autoComplete="off"
            />
          </div>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Interno</th>
                  <th>Ubicacion</th>
                  <th>Edad</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin resultados.</td>
                  </tr>
                ) : (
                  paginated.map((profile) => (
                    <tr key={profile.id} onClick={() => openInternalModal(profile)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="record-title inline">
                          <strong>{profile.fullName}</strong>
                          <span>
                            <StatusBadge variant={getInternalStatusMeta(profile.estatus).variant}>
                              {getInternalStatusMeta(profile.estatus).label}
                            </StatusBadge>
                          </span>
                        </div>
                      </td>
                      <td>{profile.ubicacion}</td>
                      <td>{maskValue(profile.edad, canViewSensitiveData)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="actions-row" style={{ marginTop: "0.8rem", justifyContent: "space-between" }}>
            <span className="muted">Pagina {page} de {totalPages}</span>
            <div className="actions-row">
              <button type="button" className="button-soft" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                Anterior
              </button>
              <button type="button" className="button-soft" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                Siguiente
              </button>
            </div>
          </div>
        </article>

        <article className="form-card">
          <strong className="section-title">Nuevo interno</strong>
          <MutationBanner state={createState} />
          <form ref={internalFormRef} action={createAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
            <div className="field">
              <input name="nombres" placeholder="Nombres" autoComplete="off" />
            </div>
            <div className="field">
              <input name="apellido_pat" placeholder="Apellido paterno" autoComplete="off" />
            </div>
            <div className="field">
              <input name="apellido_mat" placeholder="Apellido materno" autoComplete="off" />
            </div>
            <div className="field">
              <input name="ubicacion" placeholder="Ubicacion 1-101" autoComplete="off" />
            </div>
            <div className="field">
              <input name="edad" type="number" placeholder="Edad" autoComplete="off" />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <textarea name="observaciones" placeholder="Observaciones" autoComplete="off" />
            </div>
            <div className="actions-row">
              <LoadingButton pending={createPending} label="Guardar" loadingLabel="Loading..." className="button" />
            </div>
          </form>
        </article>
      </section>

      {selected ? (
        <div
          className="modal-backdrop"
          onClick={() => setModalInternalId(null)}
        >
          <div
            className="form-card profile-shell compact"
            style={{ width: "min(100%, 1180px)", maxHeight: "92vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-top">
              <div className="record-title">
                <strong className="section-title">{selected.fullName}</strong>
                <span>
                  Ubicacion {selected.ubicacion} · {maskValue(selected.edad, canViewSensitiveData)} años
                </span>
              </div>
              <div className="actions-row">
                {roleKey === "super-admin" ? (
                  <button type="button" className="button-soft" onClick={() => setHistoryOpen((current) => !current)}>
                    Historial
                  </button>
                ) : null}
                <button type="button" className="button-soft" onClick={() => setModalInternalId(null)}>
                  Cerrar
                </button>
              </div>
            </div>

            <section className="collapse-stack" style={{ marginTop: "1rem" }}>
              <article className="data-card">
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Estatus</span>
                    <strong>
                      <StatusBadge variant={getInternalStatusMeta(selected.estatus).variant}>
                        {getInternalStatusMeta(selected.estatus).label}
                      </StatusBadge>
                    </strong>
                  </div>
                  <div className="mini-row">
                    <span>Pase</span>
                    <strong>{getPassBadge(Boolean(selectedPass))}</strong>
                  </div>
                  <div className="mini-row"><span>Fecha</span><strong>{selectedDateValue ? formatLongDate(selectedDateValue) : "Sin fecha"}</strong></div>
                  <div className="mini-row"><span>Laborando</span><strong>{selected.laborando ? "Si" : "No"}</strong></div>
                  <div className="mini-row"><span>Telefono</span><strong>{maskValue(selected.telefono || "No aplica", canViewSensitiveData)}</strong></div>
                </div>
              </article>

              {selectedPass ? (
                <MutationBanner state={{ success: null, error: `Ese interno ya tiene pase para ${formatLongDate(selectedPass.fechaVisita)}.` }} />
              ) : null}

              {!canSubmitPass && selectedVisitors.length > 0 && selectedAdults.length === 0 ? (
                <MutationBanner state={{ success: null, error: "Debes incluir al menos un adulto en el pase." }} />
              ) : null}

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>No vendran</strong>
                <div className="visitor-choice-grid">
                  {availableVisitors.length === 0 ? <span className="muted">Sin registros.</span> : availableVisitors.map((item) => (
                    <button key={item.id} type="button" className="visitor-choice-item available" onClick={() => toggleVisitor(item.visitaId)}>
                      <strong>{item.visitor.fullName}</strong>
                      <span className="muted">{maskValue(item.visitor.edad, canViewSensitiveData)} años</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Vendran</strong>
                <div className="visitor-choice-grid">
                  {selectedVisitors.length === 0 ? <span className="muted">Sin registros.</span> : selectedVisitors.map((item) => (
                    <button key={item.id} type="button" className="visitor-choice-item selected" onClick={() => toggleVisitor(item.visitaId)}>
                      <strong>{item.visitor.fullName}</strong>
                      <span className="muted">{maskValue(item.visitor.edad, canViewSensitiveData)} años</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Nueva visita</strong>
                <MutationBanner state={visitorState} />
                <form
                  key={`visitor-form-${selected.id}-${formSeed}`}
                  ref={visitorFormRef}
                  action={visitorAction}
                  className="field-grid"
                  autoComplete="off"
                >
                  <input type="hidden" name="interno_id" value={selected.id} />
                  <div className="field"><input name="nombres" placeholder="Nombres" autoComplete="off" required /></div>
                  <div className="field"><input name="apellido_pat" placeholder="Apellido paterno" autoComplete="off" required /></div>
                  <div className="field"><input name="apellido_mat" placeholder="Apellido materno" autoComplete="off" required /></div>
                  <div className="field"><input name="fecha_nacimiento" type="date" autoComplete="off" required /></div>
                  <div className="field">
                    <select name="sexo" defaultValue="" required>
                      <option value="" disabled>Sexo</option>
                      <option value="hombre">Hombre</option>
                      <option value="mujer">Mujer</option>
                    </select>
                  </div>
                  <div className="field"><input name="parentesco" placeholder="Parentesco" autoComplete="off" required /></div>
                  {canManageVisitorAvailability ? (
                    <div className="field">
                      <select name="betada" defaultValue="false">
                        <option value="false">Activo</option>
                        <option value="true">No disponible</option>
                      </select>
                    </div>
                  ) : null}
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="notas" placeholder="Notas" autoComplete="off" />
                  </div>
                  <div className="actions-row">
                    <LoadingButton pending={visitorPending} label="Guardar visita" loadingLabel="Loading..." className="button-secondary" />
                  </div>
                </form>
              </article>

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Crear pase</strong>
                <MutationBanner state={passState} />
                <form
                  key={`pass-form-${selected.id}-${formSeed}`}
                  action={passAction}
                  className="field-grid"
                  autoComplete="off"
                >
                    <input type="hidden" name="interno_id" value={selected.id} />
                    <input type="hidden" name="fecha_visita" value={selectedDateValue} />
                    {selectedVisitorIds.map((visitorId) => (
                      <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
                    ))}

                    <div className="field">
                      <label htmlFor="fecha_visita_modal">Fecha del pase</label>
                      <select id="fecha_visita_modal" value={selectedDateValue} onChange={(event) => setSelectedDateValue(event.target.value)}>
                        {availableDates.map((date) => (
                          <option key={date.id} value={date.fechaCompleta}>
                            {formatLongDate(date.fechaCompleta)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {canManageMentions(roleKey) ? (
                      <>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <textarea name="menciones" placeholder="Peticiones basicas" autoComplete="off" style={{ borderColor: "#d97706", boxShadow: "0 0 0 3px rgba(217,119,6,0.10)" }} />
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <textarea name="especiales" placeholder="Peticiones especiales" autoComplete="off" style={{ borderColor: "#c23030", boxShadow: "0 0 0 3px rgba(194,48,48,0.10)" }} />
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Articulos</label>
                          <div className="article-grid">
                            {passArticles.map((article) => (
                              <div key={article.id} className="field">
                                <label htmlFor={`article_${article.id}`}>{article.name}</label>
                                <input id={`article_${article.id}`} type="number" min="0" name={`article_qty_${article.id}`} placeholder="0" autoComplete="off" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {!selectedPass ? (
                      <div className="actions-row">
                        <LoadingButton pending={passPending} label="CREAR PASE" loadingLabel="Loading..." className="button" disabled={!canSubmitPass} />
                      </div>
                    ) : null}
                  </form>
              </article>

              {roleKey === "super-admin" && historyOpen ? (
                <section className="profile-history-stack">
                  {[
                    {
                      key: "visitas",
                      title: "Visitas",
                      count: selected.visitors.length,
                      content: selected.visitors.length === 0 ? <span className="muted">Sin visitas.</span> : selected.visitors.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{item.parentesco}</span>
                        </div>
                      ))
                    },
                    {
                      key: "aparatos",
                      title: "Aparatos registrados",
                      count: selected.devices.length,
                      content: selected.devices.length === 0 ? <span className="muted">Sin aparatos.</span> : selected.devices.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.deviceTypeName}</strong>
                          <span>{item.moduleKey} · {item.quantity}</span>
                          <small>{[item.brand, item.model].filter(Boolean).join(" / ") || "Sin detalle"}</small>
                        </div>
                      ))
                    },
                    {
                      key: "trabajo",
                      title: "Negocios y oficinas",
                      count: selected.workplaceAssignments.length,
                      content: selected.workplaceAssignments.length === 0 ? <span className="muted">Sin asignaciones.</span> : selected.workplaceAssignments.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.workplaceName}</strong>
                          <span>{item.title}</span>
                          <small>{item.workplaceType} · ${item.salary.toFixed(2)}</small>
                        </div>
                      ))
                    },
                    {
                      key: "pases",
                      title: "Historico de visitas y pases",
                      count: selected.recentPasses.length,
                      content: selected.recentPasses.length === 0 ? <span className="muted">Sin historial.</span> : selected.recentPasses.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{formatLongDate(item.fechaVisita)}</strong>
                          <span>{item.visitantes.length} visitas</span>
                        </div>
                      ))
                    },
                    {
                      key: "pagos",
                      title: "Pagos semanales",
                      count: selected.weeklyPayments.length,
                      content: selected.weeklyPayments.length === 0 ? <span className="muted">Sin pagos.</span> : selected.weeklyPayments.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.deviceTypeName}</strong>
                          <span>{compactMoney(item.amount)} · {item.status}</span>
                        </div>
                      ))
                    },
                    {
                      key: "escaleras",
                      title: "Escaleras",
                      count: selected.escalerasHistory.length,
                      content: selected.escalerasHistory.length === 0 ? <span className="muted">Sin registros.</span> : selected.escalerasHistory.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{formatLongDate(item.fechaVisita)}</strong>
                          <span>{item.status}</span>
                        </div>
                      ))
                    },
                    {
                      key: "multas",
                      title: "Multas y decomisos",
                      count: selected.fines.length + selected.seizures.length,
                      content: selected.fines.length === 0 && selected.seizures.length === 0 ? <span className="muted">Sin registros.</span> : (
                        <>
                          {selected.fines.map((item) => (
                            <div key={item.id} className="record-pill">
                              <strong>{item.concept}</strong>
                              <span>{compactMoney(item.amount)} · {item.status}</span>
                            </div>
                          ))}
                          {selected.seizures.map((item) => (
                            <div key={item.id} className="record-pill">
                              <strong>{item.concept}</strong>
                              <span>{item.status}</span>
                            </div>
                          ))}
                        </>
                      )
                    },
                    {
                      key: "movimientos",
                      title: "Cambios, venta, renta y compra",
                      count: selected.equipmentMovements.length,
                      content: selected.equipmentMovements.length === 0 ? <span className="muted">Sin movimientos.</span> : selected.equipmentMovements.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.movementType}</strong>
                          <span>{item.description}</span>
                          <small>{item.amount ? compactMoney(item.amount) : "Sin monto"}</small>
                        </div>
                      ))
                    },
                    {
                      key: "notas",
                      title: "Notas y temporalidad",
                      count: selected.notes.length,
                      content: selected.notes.length === 0 ? <span className="muted">Sin notas.</span> : selected.notes.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.title}</strong>
                          <span>{item.sourceModule}</span>
                          <small>{item.notes}</small>
                        </div>
                      ))
                    }
                  ].map((section) => {
                    const isOpen = Boolean(historySections[section.key]);
                    return (
                      <article key={section.key} className="data-card section-collapse">
                        <button
                          type="button"
                          className="button-soft collapse-trigger"
                          onClick={() => toggleHistorySection(section.key)}
                        >
                          <span>{section.title}</span>
                          <span>{section.count} {isOpen ? "−" : "+"}</span>
                        </button>
                        {isOpen ? (
                          <div className="record-stack" style={{ marginTop: "0.9rem" }}>
                            {section.content}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
              ) : null}

              {roleKey === "super-admin" ? (
                <details className="data-card section-collapse">
                  <summary>
                    <span>Cambiar estatus</span>
                    <span>{getInternalStatusMeta(selected.estatus).label}</span>
                  </summary>
                  <div className="section-collapse-body">
                    <MutationBanner state={statusState} />
                    <form action={statusAction} className="actions-row" autoComplete="off">
                      <input type="hidden" name="interno_id" value={selected.id} />
                      <div className="field" style={{ flex: 1 }}>
                        <select name="estatus" defaultValue={selected.estatus}>
                          <option value="activo">Activo</option>
                          <option value="150">150</option>
                          <option value="retenido">Retenido</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                      <LoadingButton pending={statusPending} label="Guardar estatus" loadingLabel="Loading..." className="button-soft" />
                    </form>
                  </div>
                </details>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
