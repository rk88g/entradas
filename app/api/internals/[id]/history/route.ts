import { NextResponse } from "next/server";
import { getCurrentUserProfile, getInternalHistoryById } from "@/lib/supabase/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleKey !== "super-admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const history = await getInternalHistoryById(id);

  if (!history) {
    return NextResponse.json({ error: "Interno no encontrado." }, { status: 404 });
  }

  return NextResponse.json(history);
}
