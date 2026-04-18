"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createInternalAction,
  linkVisitorAction,
  mutationInitialState
} from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { InternalProfile, VisitorRecord } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

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
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
  const [linkState, linkAction, linkPending] = useActionState(linkVisitorAction, mutationInitialState);
  const [createState, createAction, createPending] = useActionState(
    createInternalAction,
    mutationInitialState
  );

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

  const selected =
    filtered.find((item) => item.id === selectedId) ??
    profiles.find((item) => item.id === selectedId) ??
    filtered[0] ??
    null;

  const linkedVisitorIds = new Set(selected?.visitors.map((item) => item.visitaId) ?? []);
  const candidateVisitors = availableVisitors.filter(
    (visitor) => !linkedVisitorIds.has(visitor.id) && !visitor.betada && !visitor.currentInternalId
  );

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
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
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Interno</th>
                <th>Ubicacion</th>
                <th>Pase</th>
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
                    onClick={() => setSelectedId(profile.id)}
                    style={{
                      background: selected?.id === profile.id ? "rgba(15,118,110,0.08)" : undefined,
                      cursor: "pointer"
                    }}
                  >
                    <td>
                      <div className="record-title">
                        <strong>{profile.fullName}</strong>
                        <span>{profile.expediente}</span>
                      </div>
                    </td>
                    <td>{profile.ubicacion}</td>
                    <td>
                      {profile.currentDatePass ? (
                        <StatusBadge variant="warn">Registrado</StatusBadge>
                      ) : (
                        <StatusBadge variant="ok">Libre</StatusBadge>
                      )}
                    </td>
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
        <form action={createAction} className="field-grid" style={{ marginTop: "1rem" }}>
          <div className="field">
            <input name="expediente" placeholder="Expediente" />
          </div>
          <div className="field">
            <input name="nombres" placeholder="Nombres" />
          </div>
          <div className="field">
            <input name="apellido_pat" placeholder="Apellido paterno" />
          </div>
          <div className="field">
            <input name="apellido_mat" placeholder="Apellido materno" />
          </div>
          <div className="field">
            <input name="nacimiento" type="date" />
          </div>
          <div className="field">
            <input name="llego" type="date" />
          </div>
          <div className="field">
            <input name="libre" type="date" />
          </div>
          <div className="field">
            <input name="ubicacion" type="number" placeholder="Ubicacion" />
          </div>
          <div className="field">
            <input name="ubi_filiacion" placeholder="Filiacion" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <textarea name="observaciones" placeholder="Observaciones" />
          </div>
          <div className="actions-row">
            <button type="submit" className="button" disabled={createPending}>
              Guardar
            </button>
          </div>
        </form>
      </article>

      <article className="data-card" style={{ gridColumn: "1 / -1" }}>
        {selected ? (
          <>
            <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div className="record-title">
                <strong className="section-title">{selected.fullName}</strong>
                <span>
                  {selected.ubicacion} · {selected.ubiFiliacion}
                </span>
              </div>
              {selected.currentDatePass ? (
                <StatusBadge variant="warn">Ya tiene pase</StatusBadge>
              ) : (
                <StatusBadge variant="ok">Sin pase</StatusBadge>
              )}
            </div>

            <div className="split-grid">
              <div className="data-card" style={{ padding: "1rem" }}>
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Llego</span>
                    <strong>{selected.llego ? formatShortDate(selected.llego) : "-"}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Libre</span>
                    <strong>{selected.libre ? formatShortDate(selected.libre) : "-"}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Nacimiento</span>
                    <strong>{selected.nacimiento ? formatShortDate(selected.nacimiento) : "-"}</strong>
                  </div>
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Visitas</strong>
                <div className="mini-list">
                  {selected.visitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin visitas</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    selected.visitors.map((item) => (
                      <div key={item.id} className="mini-row">
                        <div className="record-title">
                          <strong>{item.visitor.fullName}</strong>
                          <span>
                            {item.parentesco} · {item.visitor.edad} años
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
              <form action={linkAction} className="field-grid" style={{ marginTop: "1rem" }}>
                <input type="hidden" name="interno_id" value={selected.id} />
                <div className="field">
                  <select name="visita_id" defaultValue="">
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
                  <input name="parentesco" placeholder="Parentesco" />
                </div>
                <label style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <input type="checkbox" name="titular" />
                  Principal
                </label>
                <div className="actions-row">
                  <button type="submit" className="button" disabled={linkPending}>
                    Asignar
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}
      </article>
    </section>
  );
}
