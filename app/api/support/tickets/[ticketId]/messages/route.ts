import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getSupportTicketMessages } from "@/lib/supabase/queries";

async function canAccessTicket(ticketId: string) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return { profile: null, allowed: false };
  }

  const supabase = await createServerSupabaseClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, created_by")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return { profile, allowed: false };
  }

  const allowed = profile.roleKey === "super-admin" || ticket.created_by === profile.id;
  return { profile, allowed };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const access = await canAccessTicket(ticketId);
  if (!access.allowed) {
    return NextResponse.json({ items: [] }, { status: 403 });
  }

  const items = await getSupportTicketMessages(ticketId);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const access = await canAccessTicket(ticketId);
  if (!access.allowed || !access.profile) {
    return NextResponse.json({ error: "No puedes responder este ticket." }, { status: 403 });
  }

  const payload = (await request.json()) as { body?: string };
  const body = String(payload.body ?? "").trim();
  if (!body) {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    sender_user_id: access.profile.id,
    body
  });

  if (error) {
    return NextResponse.json({ error: error.message || "No se pudo guardar el mensaje." }, { status: 400 });
  }

  if (access.profile.roleKey === "super-admin") {
    await supabase
      .from("support_tickets")
      .update({ assigned_to: access.profile.id })
      .eq("id", ticketId);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
