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
  getStatusDisplayLabel,
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

function getDateMeta(
  dateValue: string,
  openDate?: DateRecord | null,
  nextDate?: DateRecord | null
) {
  if (openDate?.fechaCompleta === dateValue) {
    return openDate;
  }

  if (nextDate?.fechaCompleta === dateValue) {
    return nextDate;
  }

  return null;
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
  const [createState, createAction, createPending] = useActionState(
    createInternalAction,
    mutationInitialState
  );
  const [passState, passAction, passPending] = useActionState(createPassAction, mutationInitialState);
  const [visitorState, visitorAction, visitorPending] = useActionState(
    createVisitorAction,
    mutationInitialState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateInternalStatusAction,
    mutationInitialState
  );
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
        String(profile.ubicacion).includes(normalized)
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
  const selectedDateMeta = getDateMeta(selectedDateValue, openDate, nextDate);

  useEffect(() => {
    if (passState.success) {
      setModalInternalId(null);
    }
  }, [passState.success]);

  useEffect(() => {
    if (visitorState.success) {
      visitorFormRef.current?.reset();
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

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

  function openPassModal(profile: InternalProfile) {
    setSelectedVisitorIds([]);
    setSelectedDateValue(getDefaultDateValue(roleKey, openDate, nextDate));
    setModalInternalId(profile.id);
  }

  function toggleVisitor(visitaId: string) {
    setSelectedVisitorIds((current) =>
      current.includes(visitaId)
        ? current.filter((item) => item !== visitaId)
        : [...current, visitaId]
    );
  }

  return (
    <>
      <section className="module-grid">
        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
            <strong className="section-title">Internos</strong>
          </div>

          <div className="field" style={{ marginBottom: "1rem" }}>
            <input
              id="internal-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o ubicacion"
              autoComplete="off"
            />
          </div>

          <div className="table-wrap">
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
                    <tr
                      key={profile.id}
                      onClick={() => openPassModal(profile)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="record-title">
                          <strong>{profile.fullName}</strong>
                          <span>{profile.estatus}</span>
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

          <div className="actions-row" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
            <span className="muted">
              Pagina {page} de {totalPages}
            </span>
            <div className="actions-row">
              <button
                type="button"
                className="button-soft"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className="button-soft"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </article>

        <article className="form-card">
          <strong className="section-title">Nuevo interno</strong>
          <MutationBanner state={createState} />
          <form
            ref={internalFormRef}
            action={createAction}
            className="field-grid"
            style={{ marginTop: "1rem" }}
            autoComplete="off"
          >
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
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 100
          }}
          onClick={() => setModalInternalId(null)}
        >
          <div
            className="form-card"
            style={{ width: "min(100%, 1100px)", maxHeight: "90vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="actions-row"
              style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
            >
              <div className="record-title">
                <strong className="section-title">{selected.fullName}</strong>
                <span>
                  Ubicacion {selected.ubicacion} - {maskValue(selected.edad, canViewSensitiveData)} anos
                </span>
              </div>
              <button
                type="button"
                className="button-soft"
                onClick={() => setModalInternalId(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="split-grid">
              <div className="data-card" style={{ padding: "1rem" }}>
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Telefono</span>
                    <strong>{maskValue(selected.telefono || "-", canViewSensitiveData)}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Estatus</span>
                    <strong>{selected.estatus}</strong>
                  </div>
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Pase</span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "0.35rem"
                      }}
                    >
                      {selectedPass ? (
                        <>
                          <StatusBadge variant="warn">Pase registrado</StatusBadge>
                          <span className="muted" style={{ fontSize: "0.88rem" }}>
                            {formatLongDate(selectedPass.fechaVisita)}
                          </span>
                        </>
                      ) : (
                        <StatusBadge variant="ok">Sin pase</StatusBadge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {roleKey === "super-admin" ? (
              <div className="data-card" style={{ padding: "1rem", marginTop: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Cambiar estatus</strong>
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
                  <LoadingButton
                    pending={statusPending}
                    label="Guardar estatus"
                    loadingLabel="Loading..."
                    className="button-soft"
                  />
                </form>
              </div>
            ) : null}

            {selectedPass ? (
              <div style={{ marginTop: "1rem" }}>
                <MutationBanner
                  state={{
                    success: null,
                    error: `Ese interno ya tiene pase para ${formatLongDate(selectedPass.fechaVisita)}.`
                  }}
                />
              </div>
            ) : null}

            {!canSubmitPass && selectedVisitors.length > 0 && selectedAdults.length === 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <MutationBanner
                  state={{ success: null, error: "Debes incluir al menos un adulto en el pase." }}
                />
              </div>
            ) : null}

            <div className="split-grid" style={{ marginTop: "1rem" }}>
              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>No vendran</strong>
                <div className="mini-list">
                  {availableVisitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin registros</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    availableVisitors.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mini-row"
                        onClick={() => toggleVisitor(item.visitaId)}
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "16px",
                          padding: "0.9rem 1rem",
                          background: "var(--surface)",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer"
                        }}
                      >
                        <div className="record-title">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{maskValue(item.visitor.edad, canViewSensitiveData)} anos</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Vendran</strong>
                <div className="mini-list">
                  {selectedVisitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin registros</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    selectedVisitors.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mini-row"
                        onClick={() => toggleVisitor(item.visitaId)}
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "16px",
                          padding: "0.9rem 1rem",
                          background: "var(--surface)",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer"
                        }}
                      >
                        <div className="record-title">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{maskValue(item.visitor.edad, canViewSensitiveData)} anos</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="split-grid" style={{ marginTop: "1rem" }}>
              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Nueva visita</strong>
                <MutationBanner state={visitorState} />
                <form
                  ref={visitorFormRef}
                  action={visitorAction}
                  className="field-grid"
                  style={{ marginTop: "1rem" }}
                  autoComplete="off"
                >
                  <input type="hidden" name="interno_id" value={selected.id} />
                  <div className="field">
                    <input name="nombres" placeholder="Nombres" autoComplete="off" required />
                  </div>
                  <div className="field">
                    <input name="apellido_pat" placeholder="Apellido paterno" autoComplete="off" required />
                  </div>
                  <div className="field">
                    <input name="apellido_mat" placeholder="Apellido materno" autoComplete="off" required />
                  </div>
                  <div className="field">
                    <input name="fecha_nacimiento" type="date" autoComplete="off" required />
                  </div>
                  <div className="field">
                    <select name="sexo" defaultValue="" required>
                      <option value="" disabled>Sexo</option>
                      <option value="hombre">Hombre</option>
                      <option value="mujer">Mujer</option>
                    </select>
                  </div>
                  <div className="field">
                    <input name="parentesco" placeholder="Parentesco" autoComplete="off" required />
                  </div>
                  <div className="field">
                    <input name="telefono" placeholder="Telefono" autoComplete="off" />
                  </div>
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
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <MutationBanner state={passState} />
                <form
                  action={passAction}
                  className="field-grid"
                  style={{ marginTop: "1rem" }}
                  autoComplete="off"
                >
                  <input type="hidden" name="interno_id" value={selected.id} />
                  <input type="hidden" name="fecha_visita" value={selectedDateValue} />
                  {selectedVisitorIds.map((visitorId) => (
                    <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
                  ))}

                  <div className="field">
                    <label htmlFor="fecha_visita_modal">Fecha del pase</label>
                    <select
                      id="fecha_visita_modal"
                      value={selectedDateValue}
                      onChange={(event) => setSelectedDateValue(event.target.value)}
                    >
                      {availableDates.map((date) => (
                        <option key={date.id} value={date.fechaCompleta}>
                          {getStatusDisplayLabel(date.estado)} - {formatLongDate(date.fechaCompleta)}
                        </option>
                      ))}
                    </select>
                    <span className="field-hint" style={{ color: "var(--muted)" }}>
                      Se creara para{" "}
                      {selectedDateMeta
                        ? `${formatLongDate(selectedDateMeta.fechaCompleta)}`
                        : "la fecha configurada"}
                    </span>
                  </div>

                  {canManageMentions(roleKey) ? (
                    <>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <textarea
                          name="menciones"
                          placeholder="Peticiones basicas"
                          defaultValue={selectedPass?.menciones ?? ""}
                          autoComplete="off"
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <textarea
                          name="especiales"
                          placeholder="Peticiones especiales"
                          defaultValue={selectedPass?.especiales ?? ""}
                          autoComplete="off"
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Articulos</label>
                        <div className="article-grid">
                          {passArticles.map((article) => (
                            <div key={article.id} className="field">
                              <label htmlFor={`article_${article.id}`}>{article.name}</label>
                              <input
                                id={`article_${article.id}`}
                                type="number"
                                min="0"
                                name={`article_qty_${article.id}`}
                                placeholder="0"
                                autoComplete="off"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {!selectedPass ? (
                    <div className="actions-row">
                      <LoadingButton
                        pending={passPending}
                        label="CREAR PASE"
                        loadingLabel="Loading..."
                        className="button"
                        disabled={!canSubmitPass}
                      />
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
