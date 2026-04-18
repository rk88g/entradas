"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  closeDateAction,
  createPassAction,
  mutationInitialState,
  updateClosePasswordAction
} from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { DateRecord, InternalProfile, ListingRecord, MutationState, RoleKey } from "@/lib/types";
import { canChoosePassType, canManageMentions } from "@/lib/utils";

function getPassLock(profile: InternalProfile, roleKey: RoleKey, operatingDate: DateRecord | null) {
  const currentPass = profile.currentDatePass;
  const canEditExisting =
    Boolean(currentPass) &&
    (roleKey === "super-admin" || roleKey === "control") &&
    !operatingDate?.cierre &&
    currentPass?.status !== "impreso";

  return {
    currentPass,
    canEditExisting,
    blocked: Boolean(currentPass) && !canEditExisting
  };
}

export function PassOperations({
  operatingDate,
  profiles,
  todaysPasses,
  roleKey,
  closePasswordConfigured
}: {
  operatingDate: DateRecord | null;
  profiles: InternalProfile[];
  todaysPasses: ListingRecord[];
  roleKey: RoleKey;
  closePasswordConfigured: boolean;
}) {
  const [query, setQuery] = useState("");
  const [modalInternalId, setModalInternalId] = useState<string | null>(null);
  const [selectionState, setSelectionState] = useState<MutationState>(mutationInitialState);
  const [state, action, pending] = useActionState(createPassAction, mutationInitialState);
  const [closeState, closeAction, closePending] = useActionState(closeDateAction, mutationInitialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updateClosePasswordAction,
    mutationInitialState
  );

  useEffect(() => {
    if (state.success) {
      setModalInternalId(null);
    }
  }, [state.success]);

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

  const selected = profiles.find((item) => item.id === modalInternalId) ?? null;
  const selectedLock = selected ? getPassLock(selected, roleKey, operatingDate) : null;

  function handleSelect(profile: InternalProfile) {
    if (!operatingDate) {
      setSelectionState({
        success: null,
        error: "No hay fecha abierta."
      });
      return;
    }

    const passLock = getPassLock(profile, roleKey, operatingDate);
    if (passLock.blocked) {
      setSelectionState({
        success: null,
        error: "Ese interno ya tiene pase para la fecha abierta."
      });
      setModalInternalId(null);
      return;
    }

    setSelectionState(mutationInitialState);
    setModalInternalId(profile.id);
  }

  return (
    <>
      <section className="module-grid">
        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
            <strong className="section-title">Listado</strong>
            <div className="tag-row">
              {operatingDate ? <span className="chip">{operatingDate.fechaCompleta}</span> : null}
              <span className="chip">{profiles.length}</span>
            </div>
          </div>

          <MutationBanner state={selectionState} />

          <div className="field" style={{ marginTop: "1rem" }}>
            <input
              id="pass-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar interno"
              autoComplete="off"
            />
          </div>

          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Interno</th>
                  <th>Ubicacion</th>
                  <th>Pase</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin resultados.</td>
                  </tr>
                ) : (
                  filteredProfiles.map((profile) => (
                    <tr
                      key={profile.id}
                      onClick={() => handleSelect(profile)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="record-title">
                          <strong>{profile.fullName}</strong>
                          <span>{profile.ubiFiliacion}</span>
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
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
            <strong className="section-title">Cierre</strong>
            {operatingDate ? <span className="chip">{operatingDate.fechaCompleta}</span> : null}
          </div>

          {(roleKey === "super-admin" || roleKey === "control") && operatingDate ? (
            <>
              <MutationBanner state={closeState} />
              <form
                action={closeAction}
                className="field-grid"
                style={{ marginTop: "1rem" }}
                autoComplete="off"
              >
                <input type="hidden" name="fecha_completa" value={operatingDate.fechaCompleta} />
                <div className="field">
                  <input
                    name="close_password"
                    type="password"
                    placeholder="Contrasena de cierre"
                    autoComplete="off"
                  />
                </div>
                <div className="actions-row">
                  <button className="button-secondary" type="submit" disabled={closePending}>
                    Cerrar fecha
                  </button>
                </div>
              </form>
            </>
          ) : null}

          {roleKey === "super-admin" ? (
            <>
              <div style={{ height: "1rem" }} />
              <MutationBanner state={passwordState} />
              <form
                action={passwordAction}
                className="field-grid"
                style={{ marginTop: "1rem" }}
                autoComplete="off"
              >
                <div className="field">
                  <input
                    name="close_password"
                    type="password"
                    placeholder={
                      closePasswordConfigured ? "Nueva contrasena de cierre" : "Crear contrasena de cierre"
                    }
                    autoComplete="off"
                  />
                </div>
                <div className="actions-row">
                  <button type="submit" className="button" disabled={passwordPending}>
                    Guardar contrasena
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </article>

        <article className="data-card" style={{ gridColumn: "1 / -1" }}>
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
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
                  {selected.ubicacion} - {selected.ubiFiliacion}
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

            <MutationBanner state={state} />

            <form
              action={action}
              className="field-grid"
              style={{ marginTop: "1rem" }}
              autoComplete="off"
            >
              <input type="hidden" name="interno_id" value={selected.id} />

              {canChoosePassType(roleKey) ? (
                <div className="field">
                  <select name="apartado" defaultValue={selected.currentDatePass?.area ?? "618"}>
                    <option value="618">618</option>
                    <option value="INTIMA">Suelto</option>
                  </select>
                </div>
              ) : (
                <input type="hidden" name="apartado" value="618" />
              )}

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <div className="mini-list">
                  {selected.visitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin visitas asignadas</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    selected.visitors.map((item) => {
                      const checked =
                        selected.currentDatePass?.visitantes.some(
                          (visitor) => visitor.visitorId === item.visitaId
                        ) ?? !item.visitor.betada;

                      return (
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
                              {item.parentesco} - {item.visitor.edad} anos
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            name="visitor_ids"
                            value={item.visitaId}
                            defaultChecked={checked}
                            disabled={item.visitor.betada || Boolean(operatingDate?.cierre)}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {canManageMentions(roleKey) ? (
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <textarea
                    name="menciones"
                    placeholder="Menciones"
                    defaultValue={selected.currentDatePass?.menciones ?? ""}
                    disabled={Boolean(operatingDate?.cierre)}
                    autoComplete="off"
                  />
                </div>
              ) : null}

              <div className="actions-row">
                <button
                  type="submit"
                  className="button"
                  disabled={pending || Boolean(operatingDate?.cierre) || selected.visitors.length === 0}
                >
                  {selectedLock?.canEditExisting ? "Actualizar pase" : "Guardar pase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
