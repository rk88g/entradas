"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  reassignVisitorAction,
  updateInternalIdentityAction,
  updateVisitorAvailabilityAction,
  updateVisitorIdentityAction
} from "@/app/sistema/actions";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { RemoteInternalSearchField } from "@/components/remote-internal-search-field";
import {
  InternalHistoryPayload,
  InternalSearchOption,
  MutationState,
  RoleKey,
  SupportTicketRecord,
  VisitorRecord,
  VisitorSearchOption
} from "@/lib/types";
import { formatLongDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Sin registro";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatLongDate(value.slice(0, 10))} ${date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function renderLatestChangeSummary(options: {
  changedAt?: string | null;
  details?: string[];
  emptyLabel: string;
}) {
  const details = options.details?.filter(Boolean) ?? [];
  const hasChange = Boolean(options.changedAt || details.length > 0);

  return (
    <div className="audit-last-change-card">
      <strong>Ultima modificacion</strong>
      <span>{options.changedAt ? formatDateTime(options.changedAt) : options.emptyLabel}</span>
      <div className="audit-change-list">
        {(hasChange ? details : [options.emptyLabel]).map((detail, index) => (
          <span key={`${options.changedAt ?? "empty"}-${index}`}>{detail}</span>
        ))}
      </div>
    </div>
  );
}

function mapVisitorFromHistory(
  item: InternalHistoryPayload["visitors"][number],
  internal: InternalSearchOption | null
): VisitorSearchOption {
  return {
    id: item.visitaId,
    fullName: item.visitor.fullName,
    parentesco: item.parentesco || item.visitor.parentesco,
    edad: item.visitor.edad,
    currentInternalName: internal?.fullName,
    currentInternalLocation: internal?.ubicacion,
    betada: item.visitor.betada,
    fechaBetada: item.visitor.fechaBetada ?? null,
    notas: item.visitor.notas ?? null,
    latestChangeAt: null,
    latestChangeDetails: []
  };
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload;
}

export function TicketCorrectionModal({
  ticket,
  roleKey,
  open,
  onClose
}: {
  ticket: SupportTicketRecord | null;
  roleKey: RoleKey;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedInternal, setSelectedInternal] = useState<InternalSearchOption | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorSearchOption | null>(null);
  const [visitorPool, setVisitorPool] = useState<VisitorSearchOption[]>([]);
  const [selectedReassignInternal, setSelectedReassignInternal] = useState<InternalSearchOption | null>(null);
  const [internalNamesForm, setInternalNamesForm] = useState({
    nombres: "",
    apellidoPat: "",
    apellidoMat: "",
    ubicacion: ""
  });
  const [visitorNameForm, setVisitorNameForm] = useState({
    nombreCompleto: "",
    edad: ""
  });
  const [visitorAvailabilityForm, setVisitorAvailabilityForm] = useState({
    betada: false,
    fechaBetada: "",
    notas: ""
  });
  const [internalIdentityState, internalIdentityAction, internalIdentityPending] = useActionState(
    updateInternalIdentityAction,
    mutationInitialState
  );
  const [visitorIdentityState, visitorIdentityAction, visitorIdentityPending] = useActionState(
    updateVisitorIdentityAction,
    mutationInitialState
  );
  const [visitorAvailabilityState, visitorAvailabilityAction, visitorAvailabilityPending] = useActionState(
    updateVisitorAvailabilityAction,
    mutationInitialState
  );
  const [reassignState, reassignAction, reassignPending] = useActionState(
    reassignVisitorAction,
    mutationInitialState
  );

  const canOpenCorrection = useMemo(
    () =>
      roleKey === "super-admin" &&
      ticket?.type === "correccion" &&
      ["interno", "visita"].includes(ticket.context?.entityType ?? ""),
    [roleKey, ticket]
  );

  useEffect(() => {
    if (!selectedInternal) {
      setInternalNamesForm({
        nombres: "",
        apellidoPat: "",
        apellidoMat: "",
        ubicacion: ""
      });
      return;
    }

    setInternalNamesForm({
      nombres: selectedInternal.nombres,
      apellidoPat: selectedInternal.apellidoPat,
      apellidoMat: selectedInternal.apellidoMat,
      ubicacion: selectedInternal.ubicacion
    });
  }, [selectedInternal]);

  useEffect(() => {
    setVisitorNameForm({
      nombreCompleto: selectedVisitor?.fullName ?? "",
      edad: selectedVisitor ? String(selectedVisitor.edad ?? "") : ""
    });
    setVisitorAvailabilityForm({
      betada: Boolean(selectedVisitor?.betada),
      fechaBetada: selectedVisitor?.fechaBetada ?? "",
      notas: selectedVisitor?.notas ?? ""
    });
  }, [selectedVisitor]);

  async function fetchInternalOption(internalId: string) {
    const response = await fetch(`/api/internals/search?id=${encodeURIComponent(internalId)}&limit=1`, {
      cache: "no-store"
    });
    const payload = await parseResponse<{ items?: InternalSearchOption[] }>(
      response,
      "No se pudo cargar el interno del ticket."
    );
    return payload.items?.[0] ?? null;
  }

  async function fetchVisitorOption(visitorId: string) {
    const response = await fetch(`/api/visitors/search?id=${encodeURIComponent(visitorId)}&limit=1`, {
      cache: "no-store"
    });
    const payload = await parseResponse<{ items?: VisitorSearchOption[] }>(
      response,
      "No se pudo cargar la visita del ticket."
    );
    return payload.items?.[0] ?? null;
  }

  async function fetchVisitorRecord(visitorId: string) {
    const response = await fetch(`/api/visitors/${encodeURIComponent(visitorId)}`, {
      cache: "no-store"
    });
    return parseResponse<VisitorRecord>(response, "No se pudo cargar la visita del ticket.");
  }

  async function fetchInternalHistory(internalId: string) {
    const response = await fetch(`/api/internals/${encodeURIComponent(internalId)}/history`, {
      cache: "no-store"
    });
    return parseResponse<InternalHistoryPayload>(response, "No se pudo cargar las visitas del interno.");
  }

  async function selectVisitorById(visitorId: string, fallbackVisitors?: VisitorSearchOption[]) {
    const fallback =
      fallbackVisitors?.find((item) => item.id === visitorId) ??
      visitorPool.find((item) => item.id === visitorId) ??
      null;

    if (fallback) {
      setSelectedVisitor(fallback);
    }

    const enriched = await fetchVisitorOption(visitorId);
    if (enriched) {
      setSelectedVisitor(enriched);
      setVisitorPool((current) =>
        current.map((item) => (item.id === enriched.id ? { ...item, ...enriched } : item))
      );
    }
  }

  async function loadInternalContext(internalId: string, preferredVisitorId?: string | null) {
    const [internal, history] = await Promise.all([
      fetchInternalOption(internalId),
      fetchInternalHistory(internalId)
    ]);

    setSelectedInternal(internal);
    const visitors = history.visitors.map((item) => mapVisitorFromHistory(item, internal));
    setVisitorPool(visitors);

    if (preferredVisitorId) {
      await selectVisitorById(preferredVisitorId, visitors);
      return;
    }

    setSelectedVisitor(null);
  }

  async function loadTicketContext(activeTicket: SupportTicketRecord | null) {
    if (!activeTicket?.context?.entityId) {
      setSelectedInternal(null);
      setSelectedVisitor(null);
      setVisitorPool([]);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      if (activeTicket.context.entityType === "interno") {
        await loadInternalContext(activeTicket.context.entityId, null);
      } else if (activeTicket.context.entityType === "visita") {
        const visitor = await fetchVisitorRecord(activeTicket.context.entityId);
        if (visitor.currentInternalId) {
          await loadInternalContext(visitor.currentInternalId, visitor.id);
        } else {
          const visitorOption = await fetchVisitorOption(visitor.id);
          setSelectedInternal(null);
          setVisitorPool(visitorOption ? [visitorOption] : []);
          setSelectedVisitor(visitorOption);
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar la correccion del ticket.");
      setSelectedInternal(null);
      setSelectedVisitor(null);
      setVisitorPool([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshContext() {
    if (!open) {
      return;
    }

    const activeVisitorId =
      selectedVisitor?.id ??
      (ticket?.context?.entityType === "visita" ? ticket.context.entityId ?? null : null);

    if (activeVisitorId) {
      try {
        const visitor = await fetchVisitorRecord(activeVisitorId);
        if (visitor.currentInternalId) {
          await loadInternalContext(visitor.currentInternalId, activeVisitorId);
        } else {
          const visitorOption = await fetchVisitorOption(activeVisitorId);
          setSelectedInternal(null);
          setVisitorPool(visitorOption ? [visitorOption] : []);
          setSelectedVisitor(visitorOption);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "No se pudo actualizar la vista del ticket.");
      }
      return;
    }

    if (selectedInternal?.id) {
      try {
        await loadInternalContext(selectedInternal.id, null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "No se pudo actualizar la vista del ticket.");
      }
    }
  }

  useEffect(() => {
    if (!open || !canOpenCorrection) {
      return;
    }

    void loadTicketContext(ticket);
  }, [open, canOpenCorrection, ticket?.id]);

  useEffect(() => {
    if (!open || !internalIdentityState.success) {
      return;
    }

    void refreshContext();
    router.refresh();
  }, [internalIdentityState.success, open, router]);

  useEffect(() => {
    if (!open || !visitorIdentityState.success) {
      return;
    }

    void refreshContext();
    router.refresh();
  }, [visitorIdentityState.success, open, router]);

  useEffect(() => {
    if (!open || !visitorAvailabilityState.success) {
      return;
    }

    void refreshContext();
    router.refresh();
  }, [visitorAvailabilityState.success, open, router]);

  useEffect(() => {
    if (!open || !reassignState.success) {
      return;
    }

    setSelectedReassignInternal(null);
    void refreshContext();
    router.refresh();
  }, [reassignState.success, open, router]);

  if (!open || !ticket || !canOpenCorrection) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet ticket-correction-shell" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <strong>Correccion desde Cumplido Chat</strong>
            <span className="muted">
              {ticket.subject} · {ticket.context?.label ?? "Sin registro relacionado"}
            </span>
            {ticket.context?.subtitle ? (
              <span className="muted">{ticket.context.subtitle}</span>
            ) : null}
          </div>
          <button type="button" className="button-soft" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {loadError ? (
          <div className="alert-box" style={{ marginBottom: "1rem" }}>
            <strong>Aviso</strong>
            <div>{loadError}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="note-box">Cargando interno y visitas relacionadas...</div>
        ) : (
          <div className="ticket-correction-grid">
            <article className="data-card">
              <strong style={{ display: "block", marginBottom: "0.75rem" }}>Interno relacionado</strong>
              {selectedInternal ? (
                <>
                  <div className="record-pill" style={{ marginBottom: "0.8rem" }}>
                    <strong>{selectedInternal.fullName}</strong>
                    <span>Ubicacion: {selectedInternal.ubicacion}</span>
                    <small>Estatus: {selectedInternal.estatus}</small>
                  </div>
                  {renderLatestChangeSummary({
                    changedAt: selectedInternal.latestChangeAt,
                    details: selectedInternal.latestChangeDetails,
                    emptyLabel: "Sin modificaciones registradas."
                  })}
                </>
              ) : (
                <div className="note-box">
                  <strong>Sin interno activo</strong>
                  <div>El ticket esta ligado a una visita sin interno activo en este momento.</div>
                </div>
              )}
            </article>

            <article className="data-card">
              <strong style={{ display: "block", marginBottom: "0.75rem" }}>Visitas del interno</strong>
              {visitorPool.length === 0 ? (
                <div className="muted">No hay visitas relacionadas en este ticket.</div>
              ) : (
                <div className="ticket-correction-visit-list">
                  {visitorPool.map((visitor) => (
                    <button
                      key={visitor.id}
                      type="button"
                      className={`ticket-correction-visit-chip ${selectedVisitor?.id === visitor.id ? "active" : ""}`}
                      onClick={() => void selectVisitorById(visitor.id, visitorPool)}
                    >
                      <strong>{visitor.fullName}</strong>
                      <span>{visitor.parentesco || "Sin parentesco"} · {visitor.edad} años</span>
                    </button>
                  ))}
                </div>
              )}
            </article>

            <div className="ticket-correction-columns">
              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Corregir interno</strong>
                <MutationBanner state={internalIdentityState} />
                {selectedInternal ? (
                  <form action={internalIdentityAction} className="field-grid" autoComplete="off">
                    <input type="hidden" name="interno_id" value={selectedInternal.id} />
                    <div className="field">
                      <input
                        name="nombres"
                        placeholder="Nombres"
                        autoComplete="off"
                        value={internalNamesForm.nombres}
                        onChange={(event) =>
                          setInternalNamesForm((current) => ({ ...current, nombres: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <input
                        name="apellido_pat"
                        placeholder="Apellido paterno"
                        autoComplete="off"
                        value={internalNamesForm.apellidoPat}
                        onChange={(event) =>
                          setInternalNamesForm((current) => ({ ...current, apellidoPat: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <input
                        name="apellido_mat"
                        placeholder="Apellido materno"
                        autoComplete="off"
                        value={internalNamesForm.apellidoMat}
                        onChange={(event) =>
                          setInternalNamesForm((current) => ({ ...current, apellidoMat: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <input
                        name="ubicacion"
                        placeholder="Ubicacion"
                        autoComplete="off"
                        value={internalNamesForm.ubicacion}
                        onChange={(event) =>
                          setInternalNamesForm((current) => ({ ...current, ubicacion: event.target.value }))
                        }
                      />
                    </div>
                    <div className="actions-row">
                      <LoadingButton
                        pending={internalIdentityPending}
                        label="Guardar interno"
                        loadingLabel="Loading..."
                        className="button"
                      />
                    </div>
                  </form>
                ) : (
                  <div className="muted">Primero debe existir un interno activo relacionado al ticket.</div>
                )}
              </article>

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.75rem" }}>Corregir visita</strong>
                {selectedVisitor ? (
                  <>
                    {renderLatestChangeSummary({
                      changedAt: selectedVisitor.latestChangeAt,
                      details: selectedVisitor.latestChangeDetails,
                      emptyLabel: "Sin modificaciones registradas."
                    })}
                    <div style={{ height: "0.8rem" }} />
                  </>
                ) : null}
                <MutationBanner state={visitorIdentityState} />
                <form action={visitorIdentityAction} className="field-grid" autoComplete="off">
                  <input type="hidden" name="visita_id" value={selectedVisitor?.id ?? ""} />
                  <div className="field">
                    <input
                      name="nombreCompleto"
                      placeholder="Nombre completo"
                      autoComplete="off"
                      value={visitorNameForm.nombreCompleto}
                      onChange={(event) =>
                        setVisitorNameForm((current) => ({ ...current, nombreCompleto: event.target.value }))
                      }
                      disabled={!selectedVisitor}
                    />
                  </div>
                  <div className="field">
                    <input
                      name="edad"
                      type="number"
                      min={0}
                      max={120}
                      placeholder="Edad"
                      autoComplete="off"
                      value={visitorNameForm.edad}
                      onChange={(event) =>
                        setVisitorNameForm((current) => ({ ...current, edad: event.target.value }))
                      }
                      disabled={!selectedVisitor}
                    />
                  </div>
                  <div className="actions-row">
                    <LoadingButton
                      pending={visitorIdentityPending}
                      label="Guardar visita"
                      loadingLabel="Loading..."
                      className="button-secondary"
                      disabled={!selectedVisitor}
                    />
                  </div>
                </form>

                <div style={{ height: "1rem" }} />
                <MutationBanner state={visitorAvailabilityState} />
                <form action={visitorAvailabilityAction} className="field-grid" autoComplete="off">
                  <input type="hidden" name="visita_id" value={selectedVisitor?.id ?? ""} />
                  <div className="field">
                    <select
                      name="betada"
                      value={visitorAvailabilityForm.betada ? "true" : "false"}
                      onChange={(event) =>
                        setVisitorAvailabilityForm((current) => ({
                          ...current,
                          betada: event.target.value === "true",
                          fechaBetada:
                            event.target.value === "true"
                              ? current.fechaBetada || new Date().toISOString().slice(0, 10)
                              : ""
                        }))
                      }
                      disabled={!selectedVisitor}
                    >
                      <option value="false">Activa</option>
                      <option value="true">No disponible</option>
                    </select>
                  </div>
                  <div className="field">
                    <input
                      name="fecha_betada"
                      type="date"
                      value={visitorAvailabilityForm.fechaBetada}
                      onChange={(event) =>
                        setVisitorAvailabilityForm((current) => ({ ...current, fechaBetada: event.target.value }))
                      }
                      disabled={!selectedVisitor || !visitorAvailabilityForm.betada}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea
                      name="notas"
                      placeholder="Observaciones"
                      autoComplete="off"
                      value={visitorAvailabilityForm.notas}
                      onChange={(event) =>
                        setVisitorAvailabilityForm((current) => ({ ...current, notas: event.target.value }))
                      }
                      disabled={!selectedVisitor}
                    />
                  </div>
                  <div className="actions-row">
                    <LoadingButton
                      pending={visitorAvailabilityPending}
                      label="Guardar disponibilidad"
                      loadingLabel="Loading..."
                      className="button-secondary"
                      disabled={!selectedVisitor}
                    />
                  </div>
                </form>
              </article>
            </div>

            <article className="data-card">
              <strong style={{ display: "block", marginBottom: "0.75rem" }}>Reasignar visita</strong>
              <MutationBanner state={reassignState} />
              {selectedVisitor ? (
                <form action={reassignAction} className="field-grid" autoComplete="off">
                  <input type="hidden" name="visita_id" value={selectedVisitor.id} />
                  <RemoteInternalSearchField
                    name="interno_id"
                    selected={selectedReassignInternal}
                    onSelect={setSelectedReassignInternal}
                    placeholder="Buscar interno destino"
                    excludeIds={selectedInternal?.id ? [selectedInternal.id] : []}
                  />
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
              ) : (
                <div className="muted">Selecciona una visita del bloque superior para reasignarla.</div>
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
