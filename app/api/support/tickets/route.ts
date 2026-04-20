import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

const ALLOWED_TYPES = new Set(["cambio", "correccion", "solicitud", "comentario"]);

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    subject?: string;
    type?: string;
    body?: string;
    context?: Record<string, unknown> | null;
  };

  const subject = String(payload.subject ?? "").trim();
  const type = String(payload.type ?? "").trim().toLowerCase();
  const body = String(payload.body ?? "").trim();

  if (!subject || !body) {
    return NextResponse.json({ error: "Debes capturar asunto y mensaje." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "El tipo de ticket no es valido." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      created_by: profile.id,
      subject,
      type,
      status: "abierto",
      context_snapshot: payload.context ?? {}
    })
    .select("id")
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json(
      { error: ticketError?.message || "No se pudo crear el ticket." },
      { status: 400 }
    );
  }

  const { error: messageError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    sender_user_id: profile.id,
    body
  });

  if (messageError) {
    return NextResponse.json(
      { error: messageError.message || "El ticket se creo, pero no se pudo guardar el mensaje." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ticketId: ticket.id }, { status: 200 });
}
