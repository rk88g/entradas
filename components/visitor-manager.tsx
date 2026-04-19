"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createVisitorAction, reassignVisitorAction } from "@/app/sistema/actions";
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
  const parsed = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

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
  const [modalVisitorId, setModalVisitorId] = useState<string | null>(null);
  const [createState, createAction, createPending] = useActionState(
    createVisitorAction,
    mutationInitialState
  );
  const [reassignState, reassignAction, reassignPending] = useActionState(
    reassignVisitorAction,
    mutationInitialState
  );
  const createFormRef = useRef<HTMLFormElement>(null);

  const filtered = useMemo(() => {
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selected = visitors.find((visitor) => visitor.id === modalVisitorId) ?? null;
  const canReassign = roleKey === "super-admin" || roleKey === "control";
  const canManageAvailability = roleKey === "super-admin" || roleKey === "control";
  const canViewSensitiveData = roleKey === "super-admin";
  const reassignedInternalCount = selected
    ? new Set(
        [...selected.historialInterno, selected.currentInternalName ?? ""].filter(Boolean)
      ).size
    : 0;

  useEffect(() => {
    if (createState.success) {
      createFormRef.current?.reset();
      router.refresh();
    }
  }, [createState.success, router]);

  useEffect(() => {
    if (reassignState.success) {
      router.refresh();
    }
  }, [reassignState.success, router]);

  useEffect(() => {
    if (!modalVisitorId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalVisitorId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modalVisitorId]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <>
      <section className="module-grid">
        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
            <strong className="section-title">Visitas</strong>
          </div>

          <div className="field" style={{ marginBottom: "1rem" }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar visita o interno"
              autoComplete="off"
            />
          </div>

          <div className="table-wrap">
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
                    <tr
                      key={visitor.id}
                      onClick={() => setModalVisitorId(visitor.id)}
                      style={{ cursor: "pointer" }}
                    >
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
          <strong className="section-title">Nueva visita</strong>
          <MutationBanner state={createState} />
          <form
            ref={createFormRef}
            action={createAction}
            className="field-grid"
            style={{ marginTop: "1rem" }}
            autoComplete="off"
          >
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
            {canManageAvailability ? (
              <div className="field">
                <select name="betada" defaultValue="false">
                  <option value="false">Activo</option>
                  <option value="true">No disponible</option>
                </select>
              </div>
            ) : null}
            <div className="field">
              <select name="interno_id" defaultValue="" required>
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
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <textarea name="notas" placeholder="Notas" autoComplete="off" />
            </div>
            <div className="actions-row">
              <button type="submit" className="button" disabled={createPending}>
                Guardar
              </button>
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
          onClick={() => setModalVisitorId(null)}
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
                <span>{selected.currentInternalName ?? "Sin interno asignado"}</span>
              </div>
              <button
                type="button"
                className="button-soft"
                onClick={() => setModalVisitorId(null)}
              >
                Cerrar
              </button>
            </div>

            {reassignedInternalCount > 3 ? (
              <div style={{ marginBottom: "1rem" }}>
                <MutationBanner
                  state={{
                    success: null,
                    error:
                      "Advertencia: esta visita ya ha sido reasignada a mas de 3 internos."
                  }}
                />
              </div>
            ) : null}

            <div className="split-grid">
              <div className="data-card" style={{ padding: "1rem" }}>
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Interno actual</span>
                    <strong>{selected.currentInternalName ?? "-"}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Parentesco</span>
                    <strong>{selected.parentesco}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Telefono</span>
                    <strong>{maskValue(selected.telefono ?? "-", canViewSensitiveData)}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Fecha de nacimiento</span>
                    <strong>{formatHistoryDate(selected.fechaNacimiento)}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Estatus</span>
                    <StatusBadge variant={selected.betada ? "danger" : "ok"}>
                      {getVisitorAvailabilityLabel(selected.betada)}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Historial</strong>
                <div className="mini-list">
                  {selected.historial.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin historial</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    selected.historial.map((entry) => (
                      <div key={entry.id} className="mini-row" style={{ alignItems: "flex-start" }}>
                        <div className="record-title">
                          <strong>{entry.internalName}</strong>
                          <span>{formatHistoryDate(entry.date)}</span>
                        </div>
                        <span className="chip">
                          {entry.type === "reasignacion" ? "Reasignacion" : "Visita"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {canReassign ? (
              <div style={{ marginTop: "1rem" }}>
                <MutationBanner state={reassignState} />
                <form
                  action={reassignAction}
                  className="field-grid"
                  style={{ marginTop: "1rem" }}
                  autoComplete="off"
                >
                  <input type="hidden" name="visita_id" value={selected.id} />
                  <div className="field">
                    <select name="interno_id" defaultValue="" required>
                      <option value="" disabled>
                        Reasignar a interno
                      </option>
                      {internals
                        .filter((internal) => internal.id !== selected.currentInternalId)
                        .map((internal) => (
                          <option key={internal.id} value={internal.id}>
                            {internal.fullName} - {internal.ubicacion}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="actions-row">
                    <button type="submit" className="button-secondary" disabled={reassignPending}>
                      Reasignar
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
