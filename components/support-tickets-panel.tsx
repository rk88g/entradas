"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { MutationBanner } from "@/components/mutation-banner";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { LoadingButton } from "@/components/loading-button";
import { StatusBadge } from "@/components/status-badge";
import {
  MutationState,
  RoleKey,
  SupportMessageRecord,
  SupportTicketRecord,
  SupportTicketStatus,
  SupportTicketType
} from "@/lib/types";
import { formatLongDate, fullNameFromParts } from "@/lib/utils";

const ticketTypes: Array<{ value: SupportTicketType; label: string }> = [
  { value: "cambio", label: "Cambio" },
  { value: "correccion", label: "Correccion" },
  { value: "solicitud", label: "Solicitud" },
  { value: "comentario", label: "Comentario" }
];

const ticketStatuses: SupportTicketStatus[] = [
  "abierto",
  "en platicas",
  "en autorizacion",
  "no autorizado",
  "escribiendo codigo",
  "pruebas",
  "realizado",
  "cerrado"
];

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function getTicketStatusVariant(status: SupportTicketStatus) {
  if (status === "cerrado" || status === "realizado") {
    return "ok" as const;
  }

  if (status === "no autorizado") {
    return "danger" as const;
  }

  if (status === "en autorizacion" || status === "pruebas" || status === "escribiendo codigo") {
    return "warn" as const;
  }

  return "off" as const;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${formatLongDate(value.slice(0, 10))} ${date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function SupportTicketsPanel({
  tickets,
  query,
  page,
  totalPages,
  initialSelectedTicketId,
  initialMessages,
  unreadCount,
  userId,
  roleKey,
  initialContext
}: {
  tickets: SupportTicketRecord[];
  query: string;
  page: number;
  totalPages: number;
  initialSelectedTicketId: string;
  initialMessages: SupportMessageRecord[];
  unreadCount: number;
  userId: string;
  roleKey: RoleKey;
  initialContext: {
    openNew: boolean;
    type: string;
    moduleKey?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    label?: string | null;
    subtitle?: string | null;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(query);
  const [selectedTicketId, setSelectedTicketId] = useState(initialSelectedTicketId);
  const [messages, setMessages] = useState(initialMessages);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [toastState, setToastState] = useState<MutationState>(mutationInitialState);
  const [createState, setCreateState] = useState<MutationState>(mutationInitialState);
  const [messageState, setMessageState] = useState<MutationState>(mutationInitialState);
  const [statusState, setStatusState] = useState<MutationState>(mutationInitialState);
  const [createOpen, setCreateOpen] = useState(initialContext.openNew);
  const [newType, setNewType] = useState<SupportTicketType>(
    (ticketTypes.find((item) => item.value === initialContext.type)?.value ?? "comentario") as SupportTicketType
  );
  const [newSubject, setNewSubject] = useState(
    initialContext.label
      ? `${fullNameFromParts(initialContext.type, initialContext.label).replace(/\s+/g, " ").trim()}`
      : ""
  );
  const [newBody, setNewBody] = useState(
    initialContext.label
      ? `Registro relacionado: ${initialContext.label}${initialContext.subtitle ? `\nDetalle: ${initialContext.subtitle}` : ""}`
      : ""
  );
  const [messageDraft, setMessageDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<SupportTicketStatus>(
    tickets.find((item) => item.id === initialSelectedTicketId)?.status ?? "abierto"
  );

  const selectedTicket = useMemo(
    () => tickets.find((item) => item.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    setSelectedTicketId(initialSelectedTicketId);
  }, [initialSelectedTicketId]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (selectedTicket) {
      setStatusDraft(selectedTicket.status);
    }
  }, [selectedTicket]);

  useEffect(() => {
    if (!selectedTicketId) {
      return;
    }

    void fetch(`/api/support/tickets/${selectedTicketId}/read`, {
      method: "POST"
    });
  }, [selectedTicketId]);

  useEffect(() => {
    if (!toastState.success && !toastState.error) {
      return;
    }

    const timeout = setTimeout(() => {
      setToastState(mutationInitialState);
    }, 3200);

    return () => clearTimeout(timeout);
  }, [toastState]);

  async function fetchMessages(ticketId: string, markRead = true) {
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar la conversacion.");
      }

      const payload = (await response.json()) as { items?: SupportMessageRecord[] };
      setMessages(payload.items ?? []);

      if (markRead) {
        await fetch(`/api/support/tickets/${ticketId}/read`, {
          method: "POST"
        });
      }
    } catch (error) {
      setToastState({
        success: null,
        error: error instanceof Error ? error.message : "No se pudo cargar la conversacion."
      });
    } finally {
      setMessagesLoading(false);
    }
  }

  function updateRouteParams(next: { q?: string; page?: number; ticket?: string; resetNew?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (typeof next.q !== "undefined") {
      const normalized = next.q.trim();
      if (normalized) {
        params.set("q", normalized);
      } else {
        params.delete("q");
      }
    }

    if (typeof next.page !== "undefined") {
      if (next.page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(next.page));
      }
    }

    if (typeof next.ticket !== "undefined") {
      if (next.ticket) {
        params.set("ticket", next.ticket);
      } else {
        params.delete("ticket");
      }
    }

    if (next.resetNew) {
      ["new", "type", "module", "entityType", "entityId", "label", "subtitle"].forEach((key) => params.delete(key));
    }

    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  async function handleCreateTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScreenLoading(true);
    setCreateState(mutationInitialState);

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          subject: newSubject,
          type: newType,
          body: newBody,
          context: {
            moduleKey: initialContext.moduleKey ?? null,
            entityType: initialContext.entityType ?? null,
            entityId: initialContext.entityId ?? null,
            label: initialContext.label ?? null,
            subtitle: initialContext.subtitle ?? null
          }
        })
      });

      const payload = (await response.json()) as { ticketId?: string; error?: string };
      if (!response.ok || !payload.ticketId) {
        throw new Error(payload.error || "No se pudo crear el ticket.");
      }

      setCreateState({ success: "Ticket creado.", error: null });
      setCreateOpen(false);
      setNewSubject("");
      setNewBody("");
      setMessageDraft("");
      updateRouteParams({ ticket: payload.ticketId, page: 1, resetNew: true });
      router.refresh();
    } catch (error) {
      setCreateState({
        success: null,
        error: error instanceof Error ? error.message : "No se pudo crear el ticket."
      });
    } finally {
      setScreenLoading(false);
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicketId || !messageDraft.trim()) {
      return;
    }

    setScreenLoading(true);
    setMessageState(mutationInitialState);
    try {
      const response = await fetch(`/api/support/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ body: messageDraft })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo enviar el mensaje.");
      }

      setMessageDraft("");
      setMessageState({ success: "Mensaje enviado.", error: null });
      await fetchMessages(selectedTicketId, false);
      router.refresh();
    } catch (error) {
      setMessageState({
        success: null,
        error: error instanceof Error ? error.message : "No se pudo enviar el mensaje."
      });
    } finally {
      setScreenLoading(false);
    }
  }

  async function handleUpdateStatus() {
    if (!selectedTicketId || roleKey !== "super-admin") {
      return;
    }

    setScreenLoading(true);
    setStatusState(mutationInitialState);
    try {
      const response = await fetch(`/api/support/tickets/${selectedTicketId}/status`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ status: statusDraft })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo actualizar el estatus.");
      }

      setStatusState({ success: "Estatus actualizado.", error: null });
      router.refresh();
    } catch (error) {
      setStatusState({
        success: null,
        error: error instanceof Error ? error.message : "No se pudo actualizar el estatus."
      });
    } finally {
      setScreenLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedTicketId) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    const activeChannel = supabase
      .channel(`support-active-${selectedTicketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicketId}`
        },
        async (payload) => {
          if (payload.new && typeof payload.new === "object" && "sender_user_id" in payload.new && payload.new.sender_user_id !== userId) {
            setToastState({ success: "Nuevo mensaje recibido.", error: null });
            await fetchMessages(selectedTicketId);
            router.refresh();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_tickets",
          filter: `id=eq.${selectedTicketId}`
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(activeChannel);
    };
  }, [router, selectedTicketId, userId]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    const listChannel = supabase
      .channel(`support-list-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages"
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object" && "sender_user_id" in payload.new && payload.new.sender_user_id !== userId) {
          setToastState({ success: "Tienes actividad nueva en Cumplido Chat.", error: null });
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(listChannel);
    };
  }, [router, userId]);

  return (
    <>
      <FullscreenLoading active={screenLoading || messagesLoading} />
      {(toastState.success || toastState.error) ? (
        <div className={`floating-alert ${toastState.error ? "error" : "success"}`}>
          <strong>{toastState.error ? "Aviso" : "Nuevo mensaje"}</strong>
          <span>{toastState.error ?? toastState.success}</span>
        </div>
      ) : null}

      <section className="module-panel">
        <div className="tickets-header">
          <div>
          <strong className="section-title">Cumplido Chat</strong>
            <div className="muted">No leidos: {unreadCount}</div>
          </div>
          <button type="button" className="button" onClick={() => setCreateOpen((current) => !current)}>
            {createOpen ? "Cerrar ticket nuevo" : "Nuevo ticket"}
          </button>
        </div>

        {createOpen ? (
          <article className="data-card" style={{ marginBottom: "1rem" }}>
            <strong style={{ display: "block", marginBottom: "0.75rem" }}>Abrir ticket nuevo</strong>
            <MutationBanner state={createState} />
            {initialContext.label ? (
              <div className="note-box" style={{ marginBottom: "0.8rem" }}>
                <strong>Registro relacionado</strong>
                <div>{initialContext.label}</div>
                {initialContext.subtitle ? <div className="muted">{initialContext.subtitle}</div> : null}
              </div>
            ) : null}
            <form className="field-grid" autoComplete="off" onSubmit={handleCreateTicket}>
              <div className="field">
                <select value={newType} onChange={(event) => setNewType(event.target.value as SupportTicketType)}>
                  {ticketTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <input
                  value={newSubject}
                  onChange={(event) => setNewSubject(event.target.value)}
                  placeholder="Asunto"
                  autoComplete="off"
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <textarea
                  value={newBody}
                  onChange={(event) => setNewBody(event.target.value)}
                  placeholder="Explica el cambio, correccion o comentario"
                  autoComplete="off"
                />
              </div>
              <div className="actions-row">
                <LoadingButton pending={screenLoading} label="Crear ticket" loadingLabel="Loading..." className="button" />
              </div>
            </form>
          </article>
        ) : null}

        <section className="tickets-layout">
          <article className="data-card tickets-list-card">
            <form
              className="actions-row"
              style={{ marginBottom: "0.8rem", alignItems: "stretch" }}
              onSubmit={(event) => {
                event.preventDefault();
                updateRouteParams({ q: queryInput, page: 1 });
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
                      updateRouteParams({ q: "", page: 1 });
                    }
                  }}
                  placeholder="Buscar ticket por asunto"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="button-soft">Buscar</button>
            </form>

            <div className="tickets-list">
              {tickets.length === 0 ? (
                <div className="ticket-empty">Sin tickets.</div>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`ticket-list-item ${selectedTicketId === ticket.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      updateRouteParams({ ticket: ticket.id });
                      void fetchMessages(ticket.id);
                    }}
                  >
                    <div className="ticket-list-top">
                      <strong>{ticket.subject}</strong>
                      {ticket.unreadCount > 0 ? <span className="ticket-badge">{ticket.unreadCount}</span> : null}
                    </div>
                    <div className="ticket-list-meta">
                      <StatusBadge variant={getTicketStatusVariant(ticket.status)}>{ticket.status}</StatusBadge>
                      <span>{ticket.type}</span>
                      <span>{formatDateTime(ticket.lastMessageAt)}</span>
                    </div>
                    {ticket.context?.label ? (
                      <div className="muted">{ticket.context.label}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="actions-row" style={{ marginTop: "0.8rem", justifyContent: "space-between" }}>
              <span className="muted">Pagina {page} de {totalPages}</span>
              <div className="actions-row">
                <button type="button" className="button-soft" onClick={() => updateRouteParams({ page: Math.max(1, page - 1) })} disabled={page === 1}>
                  Anterior
                </button>
                <button type="button" className="button-soft" onClick={() => updateRouteParams({ page: Math.min(totalPages, page + 1) })} disabled={page === totalPages}>
                  Siguiente
                </button>
              </div>
            </div>
          </article>

          <article className="data-card tickets-chat-card">
            {selectedTicket ? (
              <>
                <div className="tickets-chat-header">
                  <div>
                    <strong>{selectedTicket.subject}</strong>
                    <div className="muted">
                      {selectedTicket.createdByName} · {selectedTicket.type} · {formatDateTime(selectedTicket.createdAt)}
                    </div>
                    {selectedTicket.context?.label ? (
                      <div className="muted">
                        {selectedTicket.context.label}
                        {selectedTicket.context.subtitle ? ` · ${selectedTicket.context.subtitle}` : ""}
                      </div>
                    ) : null}
                  </div>
                  <div className="tickets-chat-status">
                    <StatusBadge variant={getTicketStatusVariant(selectedTicket.status)}>{selectedTicket.status}</StatusBadge>
                    {roleKey === "super-admin" ? (
                      <div className="actions-row">
                        <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as SupportTicketStatus)}>
                          {ticketStatuses.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                        <button type="button" className="button-soft" onClick={() => void handleUpdateStatus()}>
                          Cambiar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <MutationBanner state={messageState} />
                <MutationBanner state={statusState} />

                <div className="tickets-message-list">
                  {messages.length === 0 ? (
                    <div className="ticket-empty">Sin mensajes.</div>
                  ) : (
                    messages.map((message) => (
                      <article
                        key={message.id}
                        className={`ticket-message ${message.senderUserId === userId ? "own" : ""}`}
                      >
                        <div className="ticket-message-head">
                          <strong>{message.senderName}</strong>
                          <span>{formatDateTime(message.createdAt)}</span>
                        </div>
                        <div className="ticket-message-body">{message.body}</div>
                      </article>
                    ))
                  )}
                </div>

                <form className="field-grid" autoComplete="off" onSubmit={handleSendMessage}>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder="Escribe tu mensaje"
                      autoComplete="off"
                    />
                  </div>
                  <div className="actions-row">
                    <LoadingButton pending={screenLoading} label="Enviar mensaje" loadingLabel="Loading..." className="button" disabled={!selectedTicketId || !messageDraft.trim()} />
                  </div>
                </form>
              </>
            ) : (
              <div className="ticket-empty">Selecciona un ticket para abrir el chat.</div>
            )}
          </article>
        </section>
      </section>
    </>
  );
}
