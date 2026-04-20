import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

const ALLOWED_STATUSES = new Set([
  "abierto",
  "en platicas",
  "en autorizacion",
  "no autorizado",
  "escribiendo codigo",
  "pruebas",
  "realizado",
  "cerrado"
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile?.active || profile.roleKey !== "super-admin") {
    return NextResponse.json({ error: "Solo super-admin puede cambiar el estatus." }, { status: 403 });
  }

  const payload = (await request.json()) as { status?: string };
  const status = String(payload.status ?? "").trim().toLowerCase();

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Estatus invalido." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({
      status,
      assigned_to: profile.id
    })
    .eq("id", ticketId);

  if (error) {
    return NextResponse.json({ error: error.message || "No se pudo actualizar el ticket." }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
