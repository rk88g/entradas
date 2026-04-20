import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, created_by")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || (profile.roleKey !== "super-admin" && ticket.created_by !== profile.id)) {
    return NextResponse.json({ error: "No puedes abrir este ticket." }, { status: 403 });
  }

  const { error } = await supabase
    .from("support_messages")
    .update({ read_by_recipient_at: new Date().toISOString() })
    .eq("ticket_id", ticketId)
    .is("read_by_recipient_at", null)
    .neq("sender_user_id", profile.id);

  if (error) {
    return NextResponse.json({ error: error.message || "No se pudieron marcar los mensajes." }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
