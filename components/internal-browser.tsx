"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createInternalAction,
  createPassAction,
  createVisitorAction,
  updateInternalStatusAction
} from "@/app/sistema/actions";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { DateRecord, InternalHistoryPayload, InternalProfile, ModuleDeviceType, MutationState, RoleKey } from "@/lib/types";
import {
  canManageMentions,
  formatLongDate,
  formatLongDateWithWeekday,
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

function normalizeVisitorSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getEstimatedBirthDateFromAge(ageValue: string) {
  const age = Number(ageValue);
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return "";
  }

  return `01/01/${new Date().getFullYear() - age}`;
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
  query,
  page,
  totalPages,
  nextDate,
  openDate,
  passArticles,
  roleKey,
  canViewSensitiveData
}: {
  profiles: InternalProfile[];
  query: string;
  page: number;
  totalPages: number;
  nextDate?: DateRecord | null;
  openDate?: DateRecord | null;
  passArticles: ModuleDeviceType[];
  roleKey: RoleKey;
  canViewSensitiveData: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(query);
  const [modalInternalId, setModalInternalId] = useState<string | null>(null);
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<string[]>([]);
  const [selectedDateValue, setSelectedDateValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySections, setHistorySections] = useState<Record<string, boolean>>({});
  const [historyCache, setHistoryCache] = useState<Record<string, InternalHistoryPayload | undefined>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formSeed, setFormSeed] = useState(0);
  const [modalBannerResetKey, setModalBannerResetKey] = useState(0);
  const [visitorBannerStateKey, setVisitorBannerStateKey] = useState(0);
  const [passBannerStateKey, setPassBannerStateKey] = useState(0);
  const [statusBannerStateKey, setStatusBannerStateKey] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [visitorQuery, setVisitorQuery] = useState("");
  const [allowDuplicatePass, setAllowDuplicatePass] = useState(false);
  const [recentCreatedPass, setRecentCreatedPass] = useState<{ internoId: string; fechaVisita: string } | null>(null);
  const [visitorBirthInputMode, setVisitorBirthInputMode] = useState<"fecha" | "edad">("fecha");
  const [visitorAgeInput, setVisitorAgeInput] = useState("");
  const [createState, createAction, createPending] = useActionState(createInternalAction, mutationInitialState);
  const [passState, passAction, passPending] = useActionState(createPassAction, mutationInitialState);
  const [visitorState, visitorAction, visitorPending] = useActionState(createVisitorAction, mutationInitialState);
  const [statusState, statusAction, statusPending] = useActionState(updateInternalStatusAction, mutationInitialState);
  const visitorFormRef = useRef<HTMLFormElement>(null);
  const internalFormRef = useRef<HTMLFormElement>(null);
  const handledPassSuccessKeyRef = useRef<number | null>(null);
  const pendingPassContextRef = useRef<{ internoId: string; fechaVisita: string } | null>(null);
  const canManageVisitorAvailability = roleKey === "super-admin" || roleKey === "control";
  const canUseFallbackParentesco = canManageVisitorAvailability;

  const availableDates = useMemo(() => getDateOptions(openDate, nextDate), [openDate, nextDate]);
  const selected = profiles.find((item) => item.id === modalInternalId) ?? null;
  const selectedPass =
    selected && selectedDateValue
      ? getPassForDate(selected, selectedDateValue, openDate, nextDate)
      : null;
  const selectedHistory = selected ? historyCache[selected.id] ?? null : null;
  const selectedVisitors =
    selected?.visitors.filter((item) => selectedVisitorIds.includes(item.visitaId)) ?? [];
  const availableVisitors =
    selected?.visitors.filter((item) => !selectedVisitorIds.includes(item.visitaId)) ?? [];
  const normalizedVisitorQuery = normalizeVisitorSearch(visitorQuery);
  const filteredAvailableVisitors = availableVisitors.filter((item) => {
    if (!normalizedVisitorQuery) {
      return true;
    }

    return normalizeVisitorSearch(
      `${item.visitor.fullName} ${item.parentesco} ${item.visitor.edad}`
    ).includes(normalizedVisitorQuery);
  });
  const filteredSelectedVisitors = selectedVisitors.filter((item) => {
    if (!normalizedVisitorQuery) {
      return true;
    }

    return normalizeVisitorSearch(
      `${item.visitor.fullName} ${item.parentesco} ${item.visitor.edad}`
    ).includes(normalizedVisitorQuery);
  });
  const selectedAdults = selectedVisitors.filter((item) => item.visitor.edad >= 18);
  const canOverrideDuplicatePass = roleKey === "super-admin" && Boolean(selectedPass) && allowDuplicatePass;
  const canSubmitPass =
    Boolean(selected) &&
    Boolean(selectedDateValue) &&
    selectedVisitors.length > 0 &&
    selectedAdults.length > 0 &&
    (!selectedPass || canOverrideDuplicatePass);
  const shouldSuppressExistingPassAlert =
    Boolean(
      selected &&
        selectedPass &&
        recentCreatedPass &&
        recentCreatedPass.internoId === selected.id &&
        recentCreatedPass.fechaVisita === selectedPass.fechaVisita &&
        passState.success
    );

  useEffect(() => {
    if (!passState.success) {
      return;
    }

    if (handledPassSuccessKeyRef.current === passBannerStateKey) {
      return;
    }

    handledPassSuccessKeyRef.current = passBannerStateKey;
    const pendingContext = pendingPassContextRef.current;
    if (pendingContext) {
      setRecentCreatedPass(pendingContext);
    }
    pendingPassContextRef.current = null;
    setSelectedVisitorIds([]);
    router.refresh();
  }, [passState.success, passBannerStateKey, router]);

  useEffect(() => {
    if (passState.error) {
      pendingPassContextRef.current = null;
    }
  }, [passState.error]);

  useEffect(() => {
    if (visitorState.success) {
      visitorFormRef.current?.reset();
      setFormSeed((current) => current + 1);
      setVisitorBirthInputMode("fecha");
      setVisitorAgeInput("");
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
    if (!createPending && !passPending && !visitorPending && !statusPending) {
      setScreenLoading(false);
    }
  }, [createPending, passPending, visitorPending, statusPending]);

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
    setQueryInput(query);
    setSearchLoading(false);
  }, [query, page, totalPages]);

  function openInternalModal(profile: InternalProfile) {
    setModalInternalId(profile.id);
    setSelectedVisitorIds([]);
    setSelectedDateValue(getDefaultDateValue(roleKey, openDate, nextDate));
      setVisitorQuery("");
      setAllowDuplicatePass(false);
      setHistoryOpen(false);
      setHistorySections({});
      setFormSeed((current) => current + 1);
      setVisitorBirthInputMode("fecha");
      setVisitorAgeInput("");
      setModalBannerResetKey((current) => current + 1);
    setRecentCreatedPass(null);
    pendingPassContextRef.current = null;
    handledPassSuccessKeyRef.current = null;
  }

  function toggleVisitor(visitaId: string) {
    setSelectedVisitorIds((current) =>
      current.includes(visitaId)
        ? current.filter((item) => item !== visitaId)
        : [...current, visitaId]
    );
  }

  useEffect(() => {
    if (!selectedPass) {
      setAllowDuplicatePass(false);
    }
  }, [selectedPass]);

  function toggleHistorySection(sectionKey: string) {
    setHistorySections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  async function toggleHistoryPanel() {
    if (!selected) {
      return;
    }

    const nextState = !historyOpen;
    setHistoryOpen(nextState);

    if (!nextState || historyCache[selected.id] || roleKey !== "super-admin") {
      return;
    }

    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/internals/${selected.id}/history`, {
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as InternalHistoryPayload;
      setHistoryCache((current) => ({
        ...current,
        [selected.id]: payload
      }));
    } finally {
      setHistoryLoading(false);
    }
  }

  function goToPage(nextPage: number) {
    if (nextPage === page) {
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function applySearch(rawValue: string) {
    const normalized = rawValue.trim();
    if (normalized === query.trim() && page === 1) {
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (normalized) {
      params.set("q", normalized);
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function openSupportTicketForInternal() {
    if (!selected) {
      return;
    }

    const params = new URLSearchParams({
      new: "1",
      type: "correccion",
      module: "internos",
      entityType: "interno",
      entityId: selected.id,
      label: selected.fullName,
      subtitle: `Ubicacion ${selected.ubicacion}`
    });

    setModalInternalId(null);
    router.push(`/sistema/tickets?${params.toString()}`);
  }

  return (
    <>
      <FullscreenLoading active={searchLoading || screenLoading || createPending || passPending || visitorPending || statusPending} />
      <section className="module-grid module-grid-single">
        <article className="data-card">
          <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <strong className="section-title">Internos</strong>
          </div>

          <form
            className="actions-row"
            style={{ marginBottom: "0.8rem", alignItems: "stretch" }}
            onSubmit={(event) => {
              event.preventDefault();
              applySearch(queryInput);
            }}
          >
            <div className="field" style={{ flex: 1 }}>
              <input
                id="internal-search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQueryInput("");
                  applySearch("");
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch(queryInput);
                }
              }}
                placeholder="Buscar por nombre o ubicacion"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="button-soft">
              Buscar
            </button>
          </form>

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
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin resultados.</td>
                  </tr>
                ) : (
                  profiles.map((profile) => (
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
              <button type="button" className="button-soft" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}>
                Anterior
              </button>
              <button type="button" className="button-soft" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                Siguiente
              </button>
            </div>
          </div>
        </article>

        <article className="form-card">
          <strong className="section-title">Nuevo interno</strong>
          <MutationBanner state={createState} />
          <form ref={internalFormRef} action={createAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
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
                <input name="ubicacion" placeholder="Ubicacion 1-101 o I-00" autoComplete="off" />
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
                <button type="button" className="button-soft" onClick={openSupportTicketForInternal}>
                  Ticket
                </button>
                {roleKey === "super-admin" ? (
                  <button type="button" className="button-soft" onClick={toggleHistoryPanel}>
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
                  <div className="mini-row"><span>Fecha</span><strong>{selectedDateValue ? formatLongDateWithWeekday(selectedDateValue) : "Sin fecha"}</strong></div>
                  <div className="mini-row"><span>Laborando</span><strong>{selected.laborando ? "Si" : "No"}</strong></div>
                  <div className="mini-row"><span>Telefono</span><strong>{maskValue(selected.telefono || "No aplica", canViewSensitiveData)}</strong></div>
                </div>
              </article>

                {selectedPass && !shouldSuppressExistingPassAlert ? (
                  <MutationBanner
                    state={{
                      success: null,
                      error:
                        roleKey === "super-admin"
                          ? `Ese interno ya tiene pase para ${formatLongDateWithWeekday(selectedPass.fechaVisita)}. Si necesitas otro, autorizalo aqui mismo para generar un nuevo pase.`
                          : `Ese interno ya tiene pase para ${formatLongDateWithWeekday(selectedPass.fechaVisita)}.`
                    }}
                  />
                ) : null}

              {!canSubmitPass && selectedVisitors.length > 0 && selectedAdults.length === 0 ? (
                <MutationBanner state={{ success: null, error: "Debes incluir al menos un adulto en el pase." }} />
              ) : null}

              <section className="two-column-section visitor-columns-section">
              <div className="field visitor-search-field" style={{ gridColumn: "1 / -1" }}>
                <input
                  value={visitorQuery}
                  onChange={(event) => setVisitorQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setVisitorQuery("");
                    }
                  }}
                  placeholder="Buscar visita del interno"
                  autoComplete="off"
                />
              </div>
              <article className="data-card visitor-column-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>No vendran</strong>
                <div className="visitor-choice-grid visitor-column-list">
                  {filteredAvailableVisitors.length === 0 ? <span className="muted visitor-column-empty">Sin registros.</span> : filteredAvailableVisitors.map((item) => (
                    <button key={item.id} type="button" className="visitor-choice-item available" onClick={() => toggleVisitor(item.visitaId)}>
                      <strong>{item.visitor.fullName}</strong>
                      <span className="muted">{maskValue(item.visitor.edad, canViewSensitiveData)} años</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="data-card visitor-column-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Vendran</strong>
                <div className="visitor-choice-grid visitor-column-list">
                  {filteredSelectedVisitors.length === 0 ? <span className="muted visitor-column-empty">Sin registros.</span> : filteredSelectedVisitors.map((item) => (
                    <button key={item.id} type="button" className="visitor-choice-item selected" onClick={() => toggleVisitor(item.visitaId)}>
                      <strong>{item.visitor.fullName}</strong>
                      <span className="muted">{maskValue(item.visitor.edad, canViewSensitiveData)} años</span>
                    </button>
                  ))}
                </div>
              </article>
              </section>


              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Nueva visita</strong>
                <MutationBanner
                  state={visitorState}
                  resetKey={modalBannerResetKey}
                  stateKey={visitorBannerStateKey}
                />
                <form
                  key={`visitor-form-${selected.id}-${formSeed}`}
                  ref={visitorFormRef}
                  action={visitorAction}
                  className="field-grid"
                  autoComplete="off"
                  onSubmitCapture={() => {
                    setVisitorBannerStateKey((current) => current + 1);
                    setScreenLoading(true);
                  }}
                  >
                    <input type="hidden" name="interno_id" value={selected.id} />
                    <div className="field" style={{ gridColumn: "1 / -1" }}><input name="nombreCompleto" placeholder="Nombre completo" autoComplete="off" required /></div>
                    <div className="field">
                      <select
                        name="birth_input_mode"
                        value={visitorBirthInputMode}
                        onChange={(event) => setVisitorBirthInputMode(event.target.value as "fecha" | "edad")}
                      >
                        <option value="fecha">Capturar por fecha</option>
                        <option value="edad">Capturar por edad</option>
                      </select>
                    </div>
                    {visitorBirthInputMode === "fecha" ? (
                      <div className="field"><input name="fecha_nacimiento" type="date" autoComplete="off" required /></div>
                    ) : (
                      <div className="field">
                        <input
                          name="edad"
                          type="number"
                          min={0}
                          max={120}
                          placeholder="Edad"
                          autoComplete="off"
                          required
                          value={visitorAgeInput}
                          onChange={(event) => setVisitorAgeInput(event.target.value)}
                        />
                        {visitorAgeInput ? (
                          <small className="muted">Nacimiento estimado: {getEstimatedBirthDateFromAge(visitorAgeInput) || "Edad invalida"}</small>
                        ) : null}
                      </div>
                    )}
                    <div className="field">
                      <select name="sexo" defaultValue="" required>
                        <option value="" disabled>Sexo</option>
                        <option value="hombre">Hombre</option>
                        <option value="mujer">Mujer</option>
                      </select>
                    </div>
                    <div className="field">
                      <input
                        name="parentesco"
                        placeholder={canUseFallbackParentesco ? "Parentesco o SN" : "Parentesco"}
                        autoComplete="off"
                        required={!canUseFallbackParentesco}
                      />
                      {canUseFallbackParentesco ? <small className="muted">Si lo dejas vacio se guardara como SN.</small> : null}
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
              </article>

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Crear pase</strong>
                <MutationBanner
                  state={passState}
                  resetKey={modalBannerResetKey}
                  stateKey={passBannerStateKey}
                />
                <form
                  key={`pass-form-${selected.id}-${formSeed}`}
                  action={passAction}
                  className="field-grid"
                  autoComplete="off"
                  onSubmitCapture={() => {
                    setPassBannerStateKey((current) => current + 1);
                    pendingPassContextRef.current = selected
                      ? {
                          internoId: selected.id,
                          fechaVisita: selectedDateValue
                        }
                      : null;
                    setScreenLoading(true);
                  }}
                >
                      <input type="hidden" name="interno_id" value={selected.id} />
                      <input type="hidden" name="fecha_visita" value={selectedDateValue} />
                      <input type="hidden" name="allow_duplicate_pass" value={allowDuplicatePass ? "true" : "false"} />
                      {selectedVisitorIds.map((visitorId) => (
                        <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
                      ))}

                    <div className="field">
                      <label htmlFor="fecha_visita_modal">Fecha del pase</label>
                      <select id="fecha_visita_modal" value={selectedDateValue} onChange={(event) => setSelectedDateValue(event.target.value)}>
                        {availableDates.map((date) => (
                          <option key={date.id} value={date.fechaCompleta}>
                            {formatLongDateWithWeekday(date.fechaCompleta)}
                          </option>
                        ))}
                      </select>
                      </div>

                      {roleKey === "super-admin" && selectedPass ? (
                        <label
                          className="record-pill"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.8rem",
                            gridColumn: "1 / -1",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allowDuplicatePass}
                            onChange={(event) => setAllowDuplicatePass(event.target.checked)}
                          />
                          <span>
                            Autorizo generar otro pase para este interno en la misma fecha.
                          </span>
                        </label>
                      ) : null}

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
                  {historyLoading && !selectedHistory ? (
                    <div className="record-pill">
                      <strong>Loading...</strong>
                      <span>Estamos cargando el historial del interno.</span>
                    </div>
                  ) : null}
                  {[
                    {
                      key: "visitas",
                      title: "Visitas",
                      count: selectedHistory?.visitors.length ?? 0,
                      content: !selectedHistory || selectedHistory.visitors.length === 0 ? <span className="muted">Sin visitas.</span> : selectedHistory.visitors.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{item.parentesco}</span>
                        </div>
                      ))
                    },
                    {
                      key: "aparatos",
                      title: "Aparatos registrados",
                      count: selectedHistory?.devices.length ?? 0,
                      content: !selectedHistory || selectedHistory.devices.length === 0 ? <span className="muted">Sin aparatos.</span> : selectedHistory.devices.map((item) => (
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
                      count: selectedHistory?.workplaceAssignments.length ?? 0,
                      content: !selectedHistory || selectedHistory.workplaceAssignments.length === 0 ? <span className="muted">Sin asignaciones.</span> : selectedHistory.workplaceAssignments.map((item) => (
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
                      count: selectedHistory?.recentPasses.length ?? 0,
                      content: !selectedHistory || selectedHistory.recentPasses.length === 0 ? <span className="muted">Sin historial.</span> : selectedHistory.recentPasses.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{formatLongDate(item.fechaVisita)}</strong>
                          <span>{item.visitantes.length} visitas</span>
                        </div>
                      ))
                    },
                    {
                      key: "pagos",
                      title: "Pagos semanales",
                      count: selectedHistory?.weeklyPayments.length ?? 0,
                      content: !selectedHistory || selectedHistory.weeklyPayments.length === 0 ? <span className="muted">Sin pagos.</span> : selectedHistory.weeklyPayments.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.deviceTypeName}</strong>
                          <span>{compactMoney(item.amount)} · {item.status}</span>
                        </div>
                      ))
                    },
                    {
                      key: "escaleras",
                      title: "Escaleras",
                      count: selectedHistory?.escalerasHistory.length ?? 0,
                      content: !selectedHistory || selectedHistory.escalerasHistory.length === 0 ? <span className="muted">Sin registros.</span> : selectedHistory.escalerasHistory.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{formatLongDate(item.fechaVisita)}</strong>
                          <span>{item.status}</span>
                        </div>
                      ))
                    },
                    {
                      key: "multas",
                      title: "Multas y decomisos",
                      count: (selectedHistory?.fines.length ?? 0) + (selectedHistory?.seizures.length ?? 0),
                      content: !selectedHistory || (selectedHistory.fines.length === 0 && selectedHistory.seizures.length === 0) ? <span className="muted">Sin registros.</span> : (
                        <>
                          {selectedHistory.fines.map((item) => (
                            <div key={item.id} className="record-pill">
                              <strong>{item.concept}</strong>
                              <span>{compactMoney(item.amount)} · {item.status}</span>
                            </div>
                          ))}
                          {selectedHistory.seizures.map((item) => (
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
                      count: selectedHistory?.equipmentMovements.length ?? 0,
                      content: !selectedHistory || selectedHistory.equipmentMovements.length === 0 ? <span className="muted">Sin movimientos.</span> : selectedHistory.equipmentMovements.map((item) => (
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
                      count: selectedHistory?.notes.length ?? 0,
                      content: !selectedHistory || selectedHistory.notes.length === 0 ? <span className="muted">Sin notas.</span> : selectedHistory.notes.map((item) => (
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
                    <MutationBanner
                      state={statusState}
                      resetKey={modalBannerResetKey}
                      stateKey={statusBannerStateKey}
                    />
                    <form
                      action={statusAction}
                      className="actions-row"
                      autoComplete="off"
                      onSubmitCapture={() => {
                        setStatusBannerStateKey((current) => current + 1);
                        setScreenLoading(true);
                      }}
                    >
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
