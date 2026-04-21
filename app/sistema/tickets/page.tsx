import { redirect } from "next/navigation";
import { SupportTicketsPanel } from "@/components/support-tickets-panel";
import {
  getCurrentUserProfile,
  getSupportTicketMessages,
  getSupportTicketsPage,
  getSupportUnreadCount
} from "@/lib/supabase/queries";
import { canAccessScope } from "@/lib/utils";

export default async function TicketsPage({
  searchParams
}: {
  searchParams?: Promise<{
    q?: string;
    page?: string;
    ticket?: string;
    new?: string;
    type?: string;
    module?: string;
    entityType?: string;
    entityId?: string;
    label?: string;
    subtitle?: string;
  }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const profile = await getCurrentUserProfile();

  if (!profile?.active) {
    redirect("/?error=profile");
  }

  if (!canAccessScope(profile.roleKey, profile.permissionGrants, "tickets", true)) {
    redirect("/sistema");
  }

  const query = String(resolvedSearchParams.q ?? "").trim();
  const page = Math.max(1, Number(resolvedSearchParams.page ?? "1") || 1);
  const selectedTicketId = String(resolvedSearchParams.ticket ?? "").trim();

  const [ticketsPage, unreadCount] = await Promise.all([
    getSupportTicketsPage({
      query,
      page,
      pageSize: 20
    }),
    getSupportUnreadCount()
  ]);

  const activeTicketId = selectedTicketId;
  const initialMessages = activeTicketId ? await getSupportTicketMessages(activeTicketId) : [];

  return (
    <SupportTicketsPanel
      tickets={ticketsPage.items}
      query={ticketsPage.query}
      page={ticketsPage.page}
      totalPages={Math.max(1, Math.ceil(ticketsPage.total / ticketsPage.pageSize))}
      initialSelectedTicketId={activeTicketId}
      initialMessages={initialMessages}
      unreadCount={unreadCount}
      userId={profile.id}
      roleKey={profile.roleKey}
      initialContext={{
        openNew: String(resolvedSearchParams.new ?? "") === "1",
        type: String(resolvedSearchParams.type ?? "").trim() || "comentario",
        moduleKey: String(resolvedSearchParams.module ?? "").trim() || null,
        entityType: String(resolvedSearchParams.entityType ?? "").trim() || null,
        entityId: String(resolvedSearchParams.entityId ?? "").trim() || null,
        label: String(resolvedSearchParams.label ?? "").trim() || null,
        subtitle: String(resolvedSearchParams.subtitle ?? "").trim() || null
      }}
    />
  );
}
