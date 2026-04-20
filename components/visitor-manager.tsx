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
import { formatLongDate, getVisitorAvailabilityLabel, maskValue } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function formatHistoryDate(value: string) {
  const normalized = value.slice(0, 10);
  return formatLongDate(normalized);
}

export function VisitorManager({
  visitors,
  query,
  page,
  totalPages,
  roleKey
}: {
  visitors: VisitorRecord[];
  query: string;
  page: number;
  totalPages: number;
  roleKey: RoleKey;
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
  const [screenLoading, setScreenLoading] = useState(false);
  const [createState, createAction, createPending] = useActionState(createVisitorAction, mutationInitialState);
  const [reassignState, reassignAction, reassignPending] = useActionState(reassignVisitorAction, mutationInitialState);
  const createFormRef = useRef<HTMLFormElement>(null);

  const selectedVisitor = visitors.find((visitor) => visitor.id === selectedVisitorId) ?? null;
  const canReassign = roleKey === "super-admin";
  const canManageAvailability = roleKey === "super-admin" || roleKey === "control";
  const canViewSensitiveData = roleKey === "super-admin";
  const reassignedInternalCount = selectedVisitor
    ? new Set(
        [...selectedVisitor.historialInterno, selectedVisitor.currentInternalName ?? ""].filter(Boolean)
      ).size
    : 0;

  useEffect(() => {
    if (createState.success) {
      createFormRef.current?.reset();
      setSelectedCreateInternal(null);
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
  }, [query]);

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
    const params = new URLSearchParams(searchParams.toString());
    const normalized = rawValue.trim();
    if (normalized) {
      params.set("q", normalized);
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  return (
    <section className="module-grid module-grid-single">
      <FullscreenLoading active={screenLoading || createPending || reassignPending} />
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
          <strong className="section-title">Visitas</strong>
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
                    <td>
                      <div className="record-title inline">
                        <strong>{visitor.fullName}</strong>
                        <span>{visitor.parentesco}</span>
                      </div>
                    </td>
                    <td>{visitor.currentInternalName ?? "-"}</td>
                    <td>{maskValue(visitor.edad, canViewSensitiveData)}</td>
                    <td>
                      <StatusBadge variant={visitor.betada ? "danger" : "ok"}>
                        {getVisitorAvailabilityLabel(visitor.betada)}
                      </StatusBadge>
                    </td>
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

            <article className="data-card section-collapse">
              <button type="button" className="button-soft collapse-trigger" onClick={() => toggleSection("perfil")}>
                <span>Perfil de visita</span>
                <span>{sectionsOpen.perfil ? "−" : "+"}</span>
              </button>
              {sectionsOpen.perfil ? (
                <div className="section-collapse-body">
                  <div className="mini-list">
                    <div className="mini-row"><span>Interno actual</span><strong>{selectedVisitor.currentInternalName ?? "Sin interno"}</strong></div>
                    <div className="mini-row"><span>Parentesco</span><strong>{selectedVisitor.parentesco}</strong></div>
                    <div className="mini-row"><span>Telefono</span><strong>{maskValue(selectedVisitor.telefono ?? "No aplica", canViewSensitiveData)}</strong></div>
                    <div className="mini-row"><span>Nacimiento</span><strong>{formatHistoryDate(selectedVisitor.fechaNacimiento)}</strong></div>
                    <div className="mini-row"><span>Edad</span><strong>{maskValue(selectedVisitor.edad, canViewSensitiveData)}</strong></div>
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
                          <strong>{entry.internalName}</strong>
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
                <div className="field"><input name="fecha_nacimiento" type="date" autoComplete="off" required /></div>
                <div className="field">
                  <select name="sexo" defaultValue="" required>
                    <option value="" disabled>Sexo</option>
                    <option value="hombre">Hombre</option>
                    <option value="mujer">Mujer</option>
                  </select>
                </div>
                <div className="field"><input name="parentesco" placeholder="Parentesco" autoComplete="off" required /></div>
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
      </article>
    </section>
  );
}
