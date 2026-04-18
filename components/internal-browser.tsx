"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createInternalAction, linkVisitorAction } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { InternalProfile, MutationState, VisitorRecord } from "@/lib/types";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

export function InternalBrowser({
  profiles,
  availableVisitors,
  operatingDate
}: {
  profiles: InternalProfile[];
  availableVisitors: VisitorRecord[];
  operatingDate?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [modalInternalId, setModalInternalId] = useState<string | null>(null);
  const [linkState, linkAction, linkPending] = useActionState(linkVisitorAction, mutationInitialState);
  const [createState, createAction, createPending] = useActionState(
    createInternalAction,
    mutationInitialState
  );

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

  const selected = profiles.find((item) => item.id === modalInternalId) ?? null;
  const linkedVisitorIds = new Set(selected?.visitors.map((item) => item.visitaId) ?? []);
  const candidateVisitors = availableVisitors.filter(
    (visitor) => !linkedVisitorIds.has(visitor.id) && !visitor.betada && !visitor.currentInternalId
  );

  return (
    <>
      <section className="module-grid">
        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
            <strong className="section-title">Internos</strong>
            <div className="tag-row">
              {operatingDate ? <span className="chip">{operatingDate}</span> : null}
              <span className="chip">{profiles.length}</span>
            </div>
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin resultados.</td>
                  </tr>
                ) : (
                  filtered.map((profile) => (
                    <tr
                      key={profile.id}
                      onClick={() => setModalInternalId(profile.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <strong>{profile.fullName}</strong>
                      </td>
                      <td>{profile.ubicacion}</td>
                      <td>{profile.edad}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="form-card">
          <strong className="section-title">Nuevo interno</strong>
          <MutationBanner state={createState} />
          <form
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
              <input name="ubicacion" type="number" placeholder="Ubicacion" autoComplete="off" />
            </div>
            <div className="field">
              <input name="edad" type="number" placeholder="Edad" autoComplete="off" />
            </div>
            <div className="field">
              <input name="telefono" placeholder="Telefono" autoComplete="off" />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <textarea name="observaciones" placeholder="Observaciones" autoComplete="off" />
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
          onClick={() => setModalInternalId(null)}
        >
          <div
            className="form-card"
            style={{ width: "min(100%, 760px)", maxHeight: "90vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="actions-row"
              style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
            >
              <div className="record-title">
                <strong className="section-title">{selected.fullName}</strong>
                <span>
                  Ubicacion {selected.ubicacion} - {selected.edad} anos
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
                    <strong>{selected.telefono || "-"}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Familiares</span>
                    <strong>{selected.visitors.length}</strong>
                  </div>
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Familiares</strong>
                <div className="mini-list">
                  {selected.visitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin familiares</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    selected.visitors.map((item) => (
                      <div key={item.id} className="mini-row">
                        <div className="record-title">
                          <strong>{item.visitor.fullName}</strong>
                          <span>
                            {item.parentesco} - {item.visitor.edad} anos
                          </span>
                        </div>
                        {item.visitor.betada ? (
                          <StatusBadge variant="danger">Betada</StatusBadge>
                        ) : (
                          <StatusBadge variant="ok">Activa</StatusBadge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <strong style={{ display: "block", marginBottom: "0.75rem" }}>Asignar visita</strong>
              <MutationBanner state={linkState} />
              <form
                action={linkAction}
                className="field-grid"
                style={{ marginTop: "1rem" }}
                autoComplete="off"
              >
                <input type="hidden" name="interno_id" value={selected.id} />
                <div className="field">
                  <select name="visita_id" defaultValue="" autoComplete="off">
                    <option value="" disabled>
                      Selecciona una visita
                    </option>
                    {candidateVisitors.map((visitor) => (
                      <option key={visitor.id} value={visitor.id}>
                        {visitor.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <input name="parentesco" placeholder="Parentesco" autoComplete="off" />
                </div>
                <label style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <input type="checkbox" name="titular" autoComplete="off" />
                  Principal
                </label>
                <div className="actions-row">
                  <button type="submit" className="button" disabled={linkPending}>
                    Asignar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
