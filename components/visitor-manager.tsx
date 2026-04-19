"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createVisitorAction, reassignVisitorAction } from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { InternalRecord, MutationState, RoleKey, VisitorRecord } from "@/lib/types";
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
  internals,
  roleKey
}: {
  visitors: VisitorRecord[];
  internals: InternalRecord[];
  roleKey: RoleKey;
}) {
  const pageSize = 20;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(visitors[0]?.id ?? null);
  const [internalSearch, setInternalSearch] = useState("");
  const [createInternalSearch, setCreateInternalSearch] = useState("");
  const [selectedInternalId, setSelectedInternalId] = useState("");
  const [createState, createAction, createPending] = useActionState(createVisitorAction, mutationInitialState);
  const [reassignState, reassignAction] = useActionState(reassignVisitorAction, mutationInitialState);
  const createFormRef = useRef<HTMLFormElement>(null);

  const filteredVisitors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return visitors;
    }

    return visitors.filter((visitor) => {
      return (
        visitor.fullName.toLowerCase().includes(normalized) ||
        (visitor.currentInternalName ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [query, visitors]);

  const selectedVisitor = filteredVisitors.find((visitor) => visitor.id === selectedVisitorId) ?? visitors.find((visitor) => visitor.id === selectedVisitorId) ?? null;
  const totalPages = Math.max(1, Math.ceil(filteredVisitors.length / pageSize));
  const paginated = filteredVisitors.slice((page - 1) * pageSize, page * pageSize);
  const canReassign = roleKey === "super-admin";
  const canManageAvailability = roleKey === "super-admin" || roleKey === "control";
  const canViewSensitiveData = roleKey === "super-admin";
  const reassignedInternalCount = selectedVisitor
    ? new Set(
        [...selectedVisitor.historialInterno, selectedVisitor.currentInternalName ?? ""].filter(Boolean)
      ).size
    : 0;

  const filteredInternalResults = useMemo(() => {
    const normalized = internalSearch.trim().toLowerCase();
    return internals.filter((internal) => {
      if (!normalized) {
        return true;
      }

      return (
        internal.fullName.toLowerCase().includes(normalized) ||
        internal.ubicacion.toLowerCase().includes(normalized)
      );
    });
  }, [internalSearch, internals]);

  const filteredCreateInternalResults = useMemo(() => {
    const normalized = createInternalSearch.trim().toLowerCase();
    return internals.filter((internal) => {
      if (!normalized) {
        return true;
      }

      return (
        internal.fullName.toLowerCase().includes(normalized) ||
        internal.ubicacion.toLowerCase().includes(normalized)
      );
    });
  }, [createInternalSearch, internals]);

  const selectedCreateInternal = internals.find((internal) => internal.id === selectedInternalId) ?? null;

  useEffect(() => {
    if (createState.success) {
      createFormRef.current?.reset();
      setSelectedInternalId("");
      setCreateInternalSearch("");
      router.refresh();
    }
  }, [createState.success, router]);

  useEffect(() => {
    if (reassignState.success) {
      setInternalSearch("");
      router.refresh();
    }
  }, [reassignState.success, router]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
          <strong className="section-title">Visitas</strong>
        </div>

        <div className="field" style={{ marginBottom: "0.8rem" }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar visita o interno" autoComplete="off" />
        </div>

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
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sin visitas.</td>
                </tr>
              ) : (
                paginated.map((visitor) => (
                  <tr key={visitor.id} onClick={() => setSelectedVisitorId(visitor.id)} style={{ cursor: "pointer" }}>
                    <td>
                      <div className="record-title">
                        <strong>{visitor.fullName}</strong>
                        <span>{visitor.parentesco}</span>
                      </div>
                    </td>
                    <td>{visitor.currentInternalName ?? "-"}</td>
                    <td>{visitor.edad}</td>
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
            <button type="button" className="button-soft" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              Anterior
            </button>
            <button type="button" className="button-soft" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Siguiente
            </button>
          </div>
        </div>
      </article>

      <article className="form-card profile-shell compact">
        <strong className="section-title">Perfil de visita</strong>
        {selectedVisitor ? (
          <>
            {reassignedInternalCount > 3 ? (
              <MutationBanner state={{ success: null, error: "Advertencia: esta visita ya fue reasignada varias veces." }} />
            ) : null}

            <div className="profile-summary">
              <article className="data-card">
                <div className="mini-list">
                  <div className="mini-row"><span>Interno actual</span><strong>{selectedVisitor.currentInternalName ?? "Sin interno"}</strong></div>
                  <div className="mini-row"><span>Parentesco</span><strong>{selectedVisitor.parentesco}</strong></div>
                  <div className="mini-row"><span>Telefono</span><strong>{maskValue(selectedVisitor.telefono ?? "No aplica", canViewSensitiveData)}</strong></div>
                </div>
              </article>
              <article className="data-card">
                <div className="mini-list">
                  <div className="mini-row"><span>Nacimiento</span><strong>{formatHistoryDate(selectedVisitor.fechaNacimiento)}</strong></div>
                  <div className="mini-row"><span>Edad</span><strong>{selectedVisitor.edad}</strong></div>
                  <div className="mini-row">
                    <span>Estatus</span>
                    <StatusBadge variant={selectedVisitor.betada ? "danger" : "ok"}>
                      {getVisitorAvailabilityLabel(selectedVisitor.betada)}
                    </StatusBadge>
                  </div>
                </div>
              </article>
            </div>

            <div className="profile-history-grid">
              <article className="data-card">
                <strong>Historial</strong>
                <div className="record-stack" style={{ marginTop: "0.7rem" }}>
                  {selectedVisitor.historial.length === 0 ? (
                    <span className="muted">Sin historial.</span>
                  ) : (
                    selectedVisitor.historial.map((entry) => (
                      <div key={entry.id} className="record-pill">
                        <strong>{entry.internalName}</strong>
                        <span>{formatHistoryDate(entry.date)}</span>
                      </div>
                    ))
                  )}
                </div>
              </article>

              {canReassign ? (
                <article className="data-card">
                  <strong>Reasignar interno</strong>
                  <MutationBanner state={reassignState} />
                  <form action={reassignAction} className="field-grid" style={{ marginTop: "0.7rem" }} autoComplete="off">
                    <input type="hidden" name="visita_id" value={selectedVisitor.id} />
                    <div className="field">
                      <input
                        value={internalSearch}
                        onChange={(event) => setInternalSearch(event.target.value)}
                        placeholder="Buscar interno"
                        autoComplete="off"
                      />
                    </div>
                    <div className="inline-search-list">
                      {filteredInternalResults
                        .filter((internal) => internal.id !== selectedVisitor.currentInternalId)
                        .slice(0, 8)
                        .map((internal) => (
                          <button
                            key={internal.id}
                            type="submit"
                            name="interno_id"
                            value={internal.id}
                            className="inline-search-item"
                          >
                            <strong>{internal.fullName}</strong>
                            <span className="muted">{internal.ubicacion}</span>
                          </button>
                        ))}
                    </div>
                    <span className="muted">Selecciona un interno para reasignar.</span>
                  </form>
                </article>
              ) : null}
            </div>
          </>
        ) : (
          <span className="muted">Selecciona una visita para ver su perfil.</span>
        )}

        <article className="data-card">
          <strong>Nueva visita</strong>
          <MutationBanner state={createState} />
          <form ref={createFormRef} action={createAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off">
            <div className="field">
              <input
                value={createInternalSearch}
                onChange={(event) => setCreateInternalSearch(event.target.value)}
                placeholder="Buscar interno"
                autoComplete="off"
              />
            </div>
            <div className="inline-search-list">
              {filteredCreateInternalResults.slice(0, 8).map((internal) => (
                <button
                  key={internal.id}
                  type="button"
                  className={`inline-search-item ${selectedInternalId === internal.id ? "active" : ""}`}
                  onClick={() => setSelectedInternalId(internal.id)}
                >
                  <strong>{internal.fullName}</strong>
                  <span className="muted">{internal.ubicacion}</span>
                </button>
              ))}
            </div>

            <input type="hidden" name="interno_id" value={selectedInternalId} />
            {selectedCreateInternal ? (
              <div className="record-pill">
                <strong>{selectedCreateInternal.fullName}</strong>
                <span>{selectedCreateInternal.ubicacion}</span>
              </div>
            ) : null}

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
            <div className="field"><input name="telefono" placeholder="Telefono" autoComplete="off" /></div>
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
        </article>
      </article>
    </section>
  );
}
