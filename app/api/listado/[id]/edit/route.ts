import { NextResponse } from "next/server";
import { getCurrentUserProfile, getPassEditData } from "@/lib/supabase/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  if (profile.roleKey !== "super-admin") {
    return NextResponse.json({ error: "Solo super-admin puede editar pases." }, { status: 403 });
  }

  const { id } = await params;
  const data = await getPassEditData(String(id ?? "").trim());

  if (!data) {
    return NextResponse.json({ error: "No se encontro el pase." }, { status: 404 });
  }

  return NextResponse.json(data, { status: 200 });
}
