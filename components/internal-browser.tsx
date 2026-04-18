"use client";

import { useActionState, useMemo, useState } from "react";
import { linkVisitorAction, mutationInitialState } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { InternalProfile, VisitorRecord } from "@/lib/types";
import { formatLongDate, formatShortDate } from "@/lib/utils";

export function InternalBrowser({
  profiles,
  availableVisitors,
  operatingDateLabel
}: {
  profiles: InternalProfile[];
  availableVisitors: VisitorRecord[];
  operatingDateLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
  const [state, action, pending] = useActionState(linkVisitorAction, mutationInitialState);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const matchesName = profile.fullName.toLowerCase().includes(normalized);
      const matchesLocation = String(profile.ubicacion).includes(normalized);
      return matchesName || matchesLocation;
    });
  }, [profiles, query]);

  const selected = filtered.find((item) => item.id === selectedId) ?? profiles.find((item) => item.id === selectedId) ?? filtered[0];

  const linkedVisitorIds = new Set(selected?.visitors.map((item) => item.visitaId) ?? []);
  const candidateVisitors = availableVisitors.filter((visitor) => !linkedVisitorIds.has(visitor.id) && !visitor.betada);

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="record-title" style={{ marginBottom: "1rem" }}>
          <strong className="section-title">Internos</strong>
          <span>Busca por nombre o ubicacion y abre su perfil operativo.</span>
        </div>

        <div className="field" style={{ marginBottom: "1rem" }}>
          <label htmlFor="internal-search">Buscar</label>
          <input
            id="internal-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o ubicacion"
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Interno</th>
                <th>Ubicacion</th>
                <th>Filiacion</th>
                <th>Pase en operacion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>No hay coincidencias para esa busqueda.</td>
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
                    <td>{profile.ubiFiliacion}</td>
                    <td>
                      {profile.currentDatePass ? (
                        <StatusBadge variant="warn">Ya tiene pase</StatusBadge>
                      ) : (
                        <StatusBadge variant="ok">Disponible</StatusBadge>
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
        {selected ? (
          <>
            <div className="record-title">
              <strong className="section-title">{selected.fullName}</strong>
              <span>
                Ubicacion {selected.ubicacion} · {selected.ubiFiliacion}
              </span>
            </div>

            <div className="split-grid" style={{ marginTop: "1rem" }}>
              <div className="note-box">
                <strong>Perfil</strong>
                <p className="mini-copy">
                  Llegó: {selected.llego ? formatShortDate(selected.llego) : "-"}<br />
                  Libre: {selected.libre ? formatShortDate(selected.libre) : "-"}<br />
                  Nacimiento: {selected.nacimiento ? formatShortDate(selected.nacimiento) : "-"}
                </p>
              </div>
              <div className="note-box">
                <strong>Operacion</strong>
                <p className="mini-copy">
                  Fecha abierta: {operatingDateLabel}
                  <br />
                  {selected.currentDatePass
                    ? `Ya tiene pase ${selected.currentDatePass.area} para esta fecha.`
                    : "Sin pase registrado para la fecha en operación."}
                </p>
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>Visitas vinculadas</h3>
              <div className="mini-list">
                {selected.visitors.length === 0 ? (
                  <div className="mini-row">
                    <span>No hay visitas vinculadas</span>
                    <span className="chip">0</span>
                  </div>
                ) : (
                  selected.visitors.map((item) => (
                    <div key={item.id} className="mini-row">
                      <div className="record-title">
                        <strong>{item.visitor.fullName}</strong>
                        <span>
                          {item.parentesco} · {item.visitor.edad} años · {item.visitor.sexo}
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

            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>Historial reciente</h3>
              <div className="mini-list">
                {selected.recentPasses.length === 0 ? (
                  <div className="mini-row">
                    <span>Sin pases recientes</span>
                    <span className="chip">-</span>
                  </div>
                ) : (
                  selected.recentPasses.map((pass) => (
                    <div key={pass.id} className="mini-row">
                      <div className="record-title">
                        <strong>{formatLongDate(pass.fechaVisita)}</strong>
                        <span>
                          {pass.area} · {pass.visitantes.length} visita(s)
                        </span>
                      </div>
                      <span className="chip">{pass.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ marginBottom: "0.75rem" }}>Vincular nueva visita</h3>
              <MutationBanner state={state} />
              <form action={action} className="field-grid" style={{ marginTop: "1rem" }}>
                <input type="hidden" name="interno_id" value={selected.id} />
                <div className="field">
                  <label htmlFor="visita_id">Visita</label>
                  <select id="visita_id" name="visita_id" defaultValue="">
                    <option value="" disabled>
                      Selecciona una visita
                    </option>
                    {candidateVisitors.map((visitor) => (
                      <option key={visitor.id} value={visitor.id}>
                        {visitor.fullName} · {visitor.parentesco}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="parentesco">Parentesco</label>
                  <input id="parentesco" name="parentesco" placeholder="Esposa, hermano, hija..." />
                </div>
                <label style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <input type="checkbox" name="titular" />
                  Marcar como visita principal
                </label>
                <div className="actions-row">
                  <button type="submit" className="button" disabled={pending || !selected}>
                    Vincular visita
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <p className="muted" style={{ color: "var(--muted)" }}>
            Selecciona un interno para ver su perfil completo.
          </p>
        )}
      </article>
    </section>
  );
}

