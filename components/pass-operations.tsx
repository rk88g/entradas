"use client";

import { useActionState, useMemo, useState } from "react";
import { createPassAction, mutationInitialState } from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { DateRecord, InternalProfile, ListingRecord, RoleKey } from "@/lib/types";
import { canChoosePassType, canManageMentions } from "@/lib/utils";

export function PassOperations({
  operatingDate,
  profiles,
  todaysPasses,
  roleKey
}: {
  operatingDate: DateRecord | null;
  profiles: InternalProfile[];
  todaysPasses: ListingRecord[];
  roleKey: RoleKey;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
  const [state, action, pending] = useActionState(createPassAction, mutationInitialState);

  const filteredProfiles = useMemo(() => {
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
    filteredProfiles.find((item) => item.id === selectedId) ??
    profiles.find((item) => item.id === selectedId) ??
    filteredProfiles[0] ??
    null;

  return (
    <section className="module-grid">
      <article className="data-card">
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong className="section-title">Pases</strong>
          <div className="tag-row">
            {operatingDate ? <span className="chip">{operatingDate.fechaCompleta}</span> : null}
            <span className="chip">{profiles.length}</span>
          </div>
        </div>

        <MutationBanner state={state} />

        <div className="field" style={{ marginTop: "1rem" }}>
          <input
            id="pass-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar interno"
          />
        </div>

        <div className="mini-list" style={{ marginTop: "1rem" }}>
          {filteredProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className="mini-row"
              style={{
                border: "1px solid var(--line)",
                borderRadius: "16px",
                background:
                  selected?.id === profile.id ? "rgba(15,118,110,0.08)" : "var(--surface-strong)"
              }}
              onClick={() => setSelectedId(profile.id)}
            >
              <div className="record-title" style={{ textAlign: "left" }}>
                <strong>
                  {profile.fullName} · {profile.ubicacion}
                </strong>
                <span>{profile.ubiFiliacion}</span>
              </div>
              {profile.currentDatePass ? (
                <StatusBadge variant="warn">Registrado</StatusBadge>
              ) : (
                <StatusBadge variant="ok">Libre</StatusBadge>
              )}
            </button>
          ))}
        </div>
      </article>

      <article className="form-card">
        {operatingDate && selected ? (
          <form action={action} className="field-grid">
            <input type="hidden" name="interno_id" value={selected.id} />

            <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <strong className="section-title">{selected.fullName}</strong>
              {selected.currentDatePass ? (
                <StatusBadge variant="warn">Ya tiene pase</StatusBadge>
              ) : (
                <StatusBadge variant="ok">Sin pase</StatusBadge>
              )}
            </div>

            {canChoosePassType(roleKey) ? (
              <div className="field">
                <select id="apartado" name="apartado" defaultValue="618">
                  <option value="618">618</option>
                  <option value="INTIMA">Suelto</option>
                </select>
              </div>
            ) : (
              <input type="hidden" name="apartado" value="618" />
            )}

            <div className="field">
              <div className="mini-list">
                {selected.visitors.length === 0 ? (
                  <div className="mini-row">
                    <span>Sin visitas asignadas</span>
                    <span className="chip">0</span>
                  </div>
                ) : (
                  selected.visitors.map((item) => (
                    <label
                      key={item.id}
                      className="mini-row"
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: "16px",
                        padding: "0.9rem 1rem"
                      }}
                    >
                      <div className="record-title">
                        <strong>{item.visitor.fullName}</strong>
                        <span>
                          {item.parentesco} · {item.visitor.edad} años
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        name="visitor_ids"
                        value={item.visitaId}
                        defaultChecked={!item.visitor.betada}
                        disabled={item.visitor.betada || Boolean(selected.currentDatePass)}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            {canManageMentions(roleKey) ? (
              <div className="field">
                <textarea
                  id="menciones"
                  name="menciones"
                  placeholder="Menciones"
                  disabled={Boolean(selected.currentDatePass)}
                />
              </div>
            ) : null}

            <div className="actions-row">
              <button
                type="submit"
                className="button"
                disabled={
                  pending ||
                  Boolean(selected.currentDatePass) ||
                  selected.visitors.length === 0 ||
                  operatingDate.cierre
                }
              >
                Guardar pase
              </button>
            </div>
          </form>
        ) : (
          <div className="alert-box">
            <p className="mini-copy">Sin fecha abierta.</p>
          </div>
        )}
      </article>

      <article className="data-card" style={{ gridColumn: "1 / -1" }}>
        <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <strong className="section-title">Hoy</strong>
          <span className="chip">{todaysPasses.length}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Interno</th>
                <th>Ubicacion</th>
                <th>Tipo</th>
                <th>Visitas</th>
              </tr>
            </thead>
            <tbody>
              {todaysPasses.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sin registros.</td>
                </tr>
              ) : (
                todaysPasses.map((pass) => (
                  <tr key={pass.id}>
                    <td>{pass.internoNombre}</td>
                    <td>{pass.internoUbicacion}</td>
                    <td>{pass.area}</td>
                    <td>{pass.visitantes.map((item) => item.nombre).join(", ")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
