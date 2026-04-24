"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createVisitorAction, reassignVisitorAction } from "@/app/sistema/actions";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { RemoteInternalSearchField } from "@/components/remote-internal-search-field";
import { StatusBadge } from "@/components/status-badge";
import { InternalSearchOption, MutationState, RoleKey, VisitorRecord } from "@/lib/types";
import { formatLongDate, getVisitorAvailabilityLabel, maskPrivateText, maskValue, shouldMaskSensitiveInternal } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function formatHistoryDate(value: string) {
  const normalized = value.slice(0, 10);
  return formatLongDate(normalized);
}

function formatCurrentInternalLabel(name?: string | null, location?: string | null) {
  const normalizedName = String(name ?? "").trim();
  const normalizedLocation = String(location ?? "").trim();

  if (!normalizedName) {
    return "-";
  }

  return normalizedLocation ? `${normalizedName} [${normalizedLocation}]` : normalizedName;
}

function getEstimatedBirthDateFromAge(ageValue: string) {
  const age = Number(ageValue);
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return "";
  }

  return `01/01/${new Date().getFullYear() - age}`;
}

export function VisitorManager({
  visitors,
  query,
  page,
  totalPages,
  roleKey,
  canViewSensitiveData,
  title = "Visitas",
  showCreateSection = true
}: {
  visitors: VisitorRecord[];
  query: string;
  page: number;
  totalPages: number;
  roleKey: RoleKey;
  canViewSensitiveData: boolean;
  title?: string;
  showCreateSection?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(query);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(visitors[0]?.id ?? null);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    perfil: false,
    historial: false,
    reasignacion: false,
    nueva: false
  });
  const [selectedReassignInternal, setSelectedReassignInternal] = useState<InternalSearchOption | null>(null);
  const [selectedCreateInternal, setSelectedCreateInternal] = useState<InternalSearchOption | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [birthInputMode, setBirthInputMode] = useState<"fecha" | "edad">("edad");
  const [ageInput, setAgeInput] = useState("");
  const [createState, createAction, createPending] = useActionState(createVisitorAction, mutationInitialState);
  const [reassignState, reassignAction, reassignPending] = useActionState(reassignVisitorAction, mutationInitialState);
  const createFormRef = useRef<HTMLFormElement>(null);

  const selectedVisitor = visitors.find((visitor) => visitor.id === selectedVisitorId) ?? null;
  const canReassign = roleKey === "super-admin";
  const canManageAvailability = roleKey === "super-admin" || roleKey === "control";
  const canUseFallbackParentesco = canManageAvailability;
  const selectedVisitorIsSensitive = shouldMaskSensitiveInternal(roleKey, selectedVisitor?.currentInternalId);
  const reassignedInternalCount = selectedVisitor
    ? new Set(
        [...selectedVisitor.historialInterno, selectedVisitor.currentInternalName ?? ""].filter(Boolean)
      ).size
    : 0;

  useEffect(() => {
    if (createState.success) {
      createFormRef.current?.reset();
      setSelectedCreateInternal(null);
      setBirthInputMode("fecha");
      setAgeInput("");
      router.refresh();
    }
  }, [createState.success, router]);

  useEffect(() => {
    if (reassignState.success) {
      setSelectedReassignInternal(null);
      router.refresh();
    }
  }, [reassignState.success, router]);

  useEffect(() => {
    setQueryInput(query);
    setSearchLoading(false);
  }, [query, page, totalPages]);

  useEffect(() => {
    if (!createPending && !reassignPending) {
      setScreenLoading(false);
    }
  }, [createPending, reassignPending]);

  function toggleSection(sectionKey: string) {
    setSectionsOpen((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
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

  function openSupportTicketForVisitor() {
    if (!selectedVisitor) {
      return;
    }

    const params = new URLSearchParams({
      new: "1",
      type: "correccion",
      module: "visitas",
      entityType: "visita",
      entityId: selectedVisitor.id,
      label: maskPrivateText(selectedVisitor.fullName, selectedVisitorIsSensitive),
      subtitle: selectedVisitor.currentInternalName
        ? `${maskPrivateText(selectedVisitor.currentInternalName, selectedVisitorIsSensitive)} · ${maskPrivateText(selectedVisitor.parentesco, selectedVisitorIsSensitive)}`
        : maskPrivateText(selectedVisitor.parentesco, selectedVisitorIsSensitive)
    });

    router.push(`/sistema/tickets?${params.toString()}`);
  }

  return (
    <section className="module-grid module-grid-single">
      <FullscreenLoading active={searchLoading || screenLoading || createPending || reassignPending} />
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
          <strong className="section-title">{title}</strong>
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
              placeholder="Buscar visita o interno"
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
                <th>Visita</th>
                <th>Interno</th>
                <th>Edad</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {visitors.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sin visitas.</td>
                </tr>
              ) : (
                visitors.map((visitor) => (
                  <tr key={visitor.id} onClick={() => setSelectedVisitorId(visitor.id)} style={{ cursor: "pointer" }}>
                    {(() => {
                      const isSensitiveVisitor = shouldMaskSensitiveInternal(roleKey, visitor.currentInternalId);
                      return (
                        <>
                    <td>
                      <div className="record-title inline">
                        <strong>{maskPrivateText(visitor.fullName, isSensitiveVisitor)}</strong>
                        <span>{maskPrivateText(visitor.parentesco, isSensitiveVisitor)}</span>
                      </div>
                    </td>
                    <td>
                      {maskPrivateText(
                        formatCurrentInternalLabel(visitor.currentInternalName, visitor.currentInternalLocation),
                        isSensitiveVisitor
                      )}
                    </td>
                    <td>{maskValue(visitor.edad, canViewSensitiveData && !isSensitiveVisitor)}</td>
                    <td>
                      <StatusBadge variant={visitor.betada ? "danger" : "ok"}>
                        {getVisitorAvailabilityLabel(visitor.betada)}
                      </StatusBadge>
                    </td>
                        </>
                      );
                    })()}
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

      <article className="form-card profile-shell compact">
        <strong className="section-title">Perfil de visita</strong>
        {selectedVisitor ? (
          <div className="collapse-stack">
            {reassignedInternalCount > 3 ? (
              <MutationBanner state={{ success: null, error: "Advertencia: esta visita ya fue reasignada varias veces." }} />
            ) : null}

            <div className="actions-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="button-soft" onClick={openSupportTicketForVisitor}>
                Ticket
              </button>
            </div>

            <article className="data-card section-collapse">
              <button type="button" className="button-soft collapse-trigger" onClick={() => toggleSection("perfil")}>
                <span>Perfil de visita</span>
                <span>{sectionsOpen.perfil ? "−" : "+"}</span>
              </button>
              {sectionsOpen.perfil ? (
                <div className="section-collapse-body">
                  <div className="mini-list">
                    <div className="mini-row"><span>Interno actual</span><strong>{maskPrivateText(selectedVisitor.currentInternalName ?? "Sin interno", selectedVisitorIsSensitive)}</strong></div>
                    <div className="mini-row"><span>Parentesco</span><strong>{maskPrivateText(selectedVisitor.parentesco, selectedVisitorIsSensitive)}</strong></div>
                    <div className="mini-row"><span>Telefono</span><strong>{maskValue(selectedVisitor.telefono ?? "No aplica", canViewSensitiveData && !selectedVisitorIsSensitive)}</strong></div>
                    <div className="mini-row"><span>Nacimiento</span><strong>{formatHistoryDate(selectedVisitor.fechaNacimiento)}</strong></div>
                    <div className="mini-row"><span>Edad</span><strong>{maskValue(selectedVisitor.edad, canViewSensitiveData && !selectedVisitorIsSensitive)}</strong></div>
                    <div className="mini-row">
                      <span>Estatus</span>
                      <StatusBadge variant={selectedVisitor.betada ? "danger" : "ok"}>
                        {getVisitorAvailabilityLabel(selectedVisitor.betada)}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>

            <article className="data-card section-collapse">
              <button type="button" className="button-soft collapse-trigger" onClick={() => toggleSection("historial")}>
                <span>Historial</span>
                <span>{selectedVisitor.historial.length} {sectionsOpen.historial ? "−" : "+"}</span>
              </button>
              {sectionsOpen.historial ? (
                <div className="section-collapse-body">
                  <div className="record-stack">
                    {selectedVisitor.historial.length === 0 ? (
                      <span className="muted">Sin historial.</span>
                    ) : (
                      selectedVisitor.historial.map((entry) => (
                        <div key={entry.id} className="record-pill">
                          <strong>{maskPrivateText(entry.internalName, selectedVisitorIsSensitive)}</strong>
                          <span>{entry.type === "reasignacion" ? "Reasignacion" : "Visita"} · {formatHistoryDate(entry.date)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </article>

            {canReassign ? (
              <article className="data-card section-collapse">
                <button type="button" className="button-soft collapse-trigger" onClick={() => toggleSection("reasignacion")}>
                  <span>Reasignar interno</span>
                  <span>{sectionsOpen.reasignacion ? "−" : "+"}</span>
                </button>
                {sectionsOpen.reasignacion ? (
                  <div className="section-collapse-body">
                    <MutationBanner state={reassignState} />
                    <form action={reassignAction} className="field-grid" autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
                      <input type="hidden" name="visita_id" value={selectedVisitor.id} />
                      <div className="field">
                        <RemoteInternalSearchField
                          name="interno_id"
                          selected={selectedReassignInternal}
                          onSelect={setSelectedReassignInternal}
                          placeholder="Buscar interno por nombre o ubicacion"
                          excludeIds={selectedVisitor.currentInternalId ? [selectedVisitor.currentInternalId] : []}
                        />
                      </div>
                      <div className="actions-row">
                        <LoadingButton
                          pending={reassignPending}
                          label="Reasignar visita"
                          loadingLabel="Loading..."
                          className="button"
                          disabled={!selectedReassignInternal}
                        />
                      </div>
                    </form>
                  </div>
                ) : null}
              </article>
            ) : null}
          </div>
        ) : (
          <span className="muted">Selecciona una visita para ver su perfil.</span>
        )}

        {showCreateSection ? (
        <article className="data-card section-collapse">
          <button type="button" className="button-soft collapse-trigger" onClick={() => toggleSection("nueva")}>
            <span>Nueva visita</span>
            <span>{sectionsOpen.nueva ? "−" : "+"}</span>
          </button>
          {sectionsOpen.nueva ? (
            <div className="section-collapse-body">
              <MutationBanner state={createState} />
                <form ref={createFormRef} action={createAction} className="field-grid" autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
                  <RemoteInternalSearchField
                    name="interno_id"
                    selected={selectedCreateInternal}
                    onSelect={setSelectedCreateInternal}
                    placeholder="Buscar interno por nombre o ubicacion"
                  />

                  <div className="field" style={{ gridColumn: "1 / -1" }}><input name="nombreCompleto" placeholder="Nombre completo" autoComplete="off" required /></div>
                  <div className="field">
                    <select
                      name="birth_input_mode"
                      value={birthInputMode}
                      onChange={(event) => setBirthInputMode(event.target.value as "fecha" | "edad")}
                    >
                      <option value="fecha">Capturar por fecha</option>
                      <option value="edad">Capturar por edad</option>
                    </select>
                  </div>
                  {birthInputMode === "fecha" ? (
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
                        value={ageInput}
                        onChange={(event) => setAgeInput(event.target.value)}
                      />
                      {ageInput ? (
                        <small className="muted">Nacimiento estimado: {getEstimatedBirthDateFromAge(ageInput) || "Edad invalida"}</small>
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
                {canManageAvailability ? (
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
                  <LoadingButton pending={createPending} label="Guardar" loadingLabel="Loading..." className="button" />
                </div>
              </form>
            </div>
          ) : null}
        </article>
        ) : null}
      </article>
    </section>
  );
}
