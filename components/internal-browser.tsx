"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInternalAction,
  createPassAction,
  createVisitorAction
} from "@/app/sistema/actions";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import { InternalProfile, MutationState, RoleKey } from "@/lib/types";
import { canChoosePassType, canManageMentions, formatLongDate } from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function getPassForArea(profile: InternalProfile, area: "618" | "INTIMA") {
  return area === "618" ? profile.nextDatePass : profile.openDatePass;
}

function getTargetDate(area: "618" | "INTIMA", nextDate?: string | null, openDate?: string | null) {
  return area === "618" ? nextDate : openDate;
}

function getPassLock(
  profile: InternalProfile,
  area: "618" | "INTIMA",
  _roleKey: RoleKey,
  nextDate?: string | null,
  openDate?: string | null
) {
  const currentPass = getPassForArea(profile, area);
  return {
    currentPass,
    blocked: Boolean(currentPass),
    targetDate: getTargetDate(area, nextDate, openDate)
  };
}

export function InternalBrowser({
  profiles,
  nextDate,
  openDate,
  roleKey
}: {
  profiles: InternalProfile[];
  nextDate?: string | null;
  openDate?: string | null;
  roleKey: RoleKey;
}) {
  const pageSize = 20;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modalInternalId, setModalInternalId] = useState<string | null>(null);
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<"618" | "INTIMA">("618");
  const [createState, createAction, createPending] = useActionState(
    createInternalAction,
    mutationInitialState
  );
  const [passState, passAction, passPending] = useActionState(createPassAction, mutationInitialState);
  const [visitorState, visitorAction, visitorPending] = useActionState(
    createVisitorAction,
    mutationInitialState
  );
  const visitorFormRef = useRef<HTMLFormElement>(null);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selected = profiles.find((item) => item.id === modalInternalId) ?? null;
  const selectedLock = selected
    ? getPassLock(selected, selectedArea, roleKey, nextDate, openDate)
    : null;

  useEffect(() => {
    if (passState.success) {
      setModalInternalId(null);
    }
  }, [passState.success]);

  useEffect(() => {
    if (visitorState.success) {
      visitorFormRef.current?.reset();
      router.refresh();
    }
  }, [router, visitorState.success]);

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
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedVisitors =
    selected?.visitors.filter((item) => selectedVisitorIds.includes(item.visitaId)) ?? [];
  const availableVisitors =
    selected?.visitors.filter((item) => !selectedVisitorIds.includes(item.visitaId)) ?? [];
  const selectedAdults = selectedVisitors.filter((item) => item.visitor.edad >= 18);
  const canSubmitPass =
    Boolean(selected) &&
    selectedVisitors.length > 0 &&
    selectedAdults.length > 0 &&
    !selectedLock?.blocked &&
    Boolean(selectedLock?.targetDate);

  function openPassModal(profile: InternalProfile) {
    const defaultArea: "618" | "INTIMA" =
      profile.nextDatePass ? "618" : profile.openDatePass ? "INTIMA" : "618";
    setSelectedVisitorIds([]);
    setSelectedArea(defaultArea);
    setModalInternalId(profile.id);
  }

  function toggleVisitor(visitaId: string) {
    setSelectedVisitorIds((current) =>
      current.includes(visitaId)
        ? current.filter((item) => item !== visitaId)
        : [...current, visitaId]
    );
  }

  return (
    <>
      <section className="module-grid">
        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
          >
            <strong className="section-title">Internos</strong>
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
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin resultados.</td>
                  </tr>
                ) : (
                  paginated.map((profile) => (
                    <tr
                      key={profile.id}
                      onClick={() => openPassModal(profile)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="record-title">
                          <strong>{profile.fullName}</strong>
                          <span>
                            {profile.nextDatePass || profile.openDatePass
                              ? "Con pase registrado"
                              : "Sin pase"}
                          </span>
                        </div>
                      </td>
                      <td>{profile.ubicacion}</td>
                      <td>{profile.edad}</td>
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
            style={{ width: "min(100%, 1100px)", maxHeight: "90vh", overflow: "auto" }}
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
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Estatus</span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "0.35rem"
                      }}
                    >
                      {selectedLock?.currentPass ? (
                        <>
                          <StatusBadge variant="warn">Pase registrado</StatusBadge>
                          <span className="muted" style={{ fontSize: "0.88rem" }}>
                            {formatLongDate(selectedLock.currentPass.fechaVisita)}
                          </span>
                        </>
                      ) : (
                        <StatusBadge variant="ok">Sin pase</StatusBadge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedLock?.blocked ? (
              <div style={{ marginTop: "1rem" }}>
                <MutationBanner
                  state={{
                    success: null,
                    error:
                      selectedArea === "618"
                        ? "Ese interno ya tiene pase 618 para la fecha proximo."
                        : "Ese interno ya tiene pase suelto para la fecha abierta."
                  }}
                />
              </div>
            ) : null}

            {!canSubmitPass && selectedVisitors.length > 0 && selectedAdults.length === 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <MutationBanner
                  state={{ success: null, error: "Debes incluir al menos un adulto en el pase." }}
                />
              </div>
            ) : null}

            <div className="split-grid" style={{ marginTop: "1rem" }}>
              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>No vendran</strong>
                <div className="mini-list">
                  {availableVisitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin registros</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    availableVisitors.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mini-row"
                        onClick={() => toggleVisitor(item.visitaId)}
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "16px",
                          padding: "0.9rem 1rem",
                          background: "white",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer"
                        }}
                      >
                        <div className="record-title">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{item.visitor.edad} anos</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Vendran</strong>
                <div className="mini-list">
                  {selectedVisitors.length === 0 ? (
                    <div className="mini-row">
                      <span>Sin registros</span>
                      <span className="chip">0</span>
                    </div>
                  ) : (
                    selectedVisitors.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mini-row"
                        onClick={() => toggleVisitor(item.visitaId)}
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "16px",
                          padding: "0.9rem 1rem",
                          background: "white",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer"
                        }}
                      >
                        <div className="record-title">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{item.visitor.edad} anos</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="split-grid" style={{ marginTop: "1rem" }}>
              <div className="data-card" style={{ padding: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Nueva visita</strong>
                <MutationBanner state={visitorState} />
                <form
                  ref={visitorFormRef}
                  action={visitorAction}
                  className="field-grid"
                  style={{ marginTop: "1rem" }}
                  autoComplete="off"
                >
                  <input type="hidden" name="interno_id" value={selected.id} />
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
                    <input name="fecha_nacimiento" type="date" autoComplete="off" />
                  </div>
                  <div className="field">
                    <select name="sexo" defaultValue="sin-definir">
                      <option value="sin-definir">Sexo</option>
                      <option value="hombre">Hombre</option>
                      <option value="mujer">Mujer</option>
                    </select>
                  </div>
                  <div className="field">
                    <input name="parentesco" placeholder="Parentesco" autoComplete="off" />
                  </div>
                  <div className="field">
                    <input name="telefono" placeholder="Telefono" autoComplete="off" />
                  </div>
                  <div className="field">
                    <select name="betada" defaultValue="false">
                      <option value="false">Activa</option>
                      <option value="true">Betada</option>
                    </select>
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="notas" placeholder="Notas" autoComplete="off" />
                  </div>
                  <div className="actions-row">
                    <button type="submit" className="button-secondary" disabled={visitorPending}>
                      Guardar visita
                    </button>
                  </div>
                </form>
              </div>

              <div className="data-card" style={{ padding: "1rem" }}>
                <MutationBanner state={passState} />
                <form
                  action={passAction}
                  className="field-grid"
                  style={{ marginTop: "1rem" }}
                  autoComplete="off"
                >
                  <input type="hidden" name="interno_id" value={selected.id} />
                  {selectedVisitorIds.map((visitorId) => (
                    <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
                  ))}

                  {canChoosePassType(roleKey) ? (
                    <div className="field">
                      <label htmlFor="apartado">Tipo de pase</label>
                      <select
                        id="apartado"
                        name="apartado"
                        value={selectedArea}
                        onChange={(event) => setSelectedArea(event.target.value as "618" | "INTIMA")}
                      >
                      <option value="618">618</option>
                      <option value="INTIMA">Suelto</option>
                      </select>
                      <span className="field-hint" style={{ color: "var(--muted)" }}>
                        Se creara para {selectedLock?.targetDate ? formatLongDate(selectedLock.targetDate) : "la fecha configurada"}
                      </span>
                    </div>
                  ) : (
                    <input type="hidden" name="apartado" value="618" />
                  )}

                  {!canChoosePassType(roleKey) ? (
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <span className="field-hint" style={{ color: "var(--muted)" }}>
                        Se creara para {selectedLock?.targetDate ? formatLongDate(selectedLock.targetDate) : "la fecha configurada"}
                      </span>
                    </div>
                  ) : null}

                  {canManageMentions(roleKey) && selectedArea === "INTIMA" ? (
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <textarea
                        name="menciones"
                        placeholder="Menciones"
                        defaultValue={selected.openDatePass?.menciones ?? ""}
                        autoComplete="off"
                      />
                    </div>
                  ) : null}

                  {!selectedLock?.currentPass ? (
                    <div className="actions-row">
                      <button
                        type="submit"
                        className="button"
                        disabled={passPending || !canSubmitPass}
                      >
                        CREAR PASE
                      </button>
                    </div>
                  ) : (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <MutationBanner
                        state={{
                          success: null,
                          error:
                            selectedArea === "618"
                              ? "Ese interno ya tiene pase 618 creado para la fecha proximo."
                              : "Ese interno ya tiene pase suelto creado para la fecha abierta."
                        }}
                      />
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
