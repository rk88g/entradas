import { NextResponse } from "next/server";
import { getCurrentUserProfile, getVisitorRecordById } from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope } from "@/lib/utils";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (
    !profile?.active ||
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "visitas",
      canAccessCoreSystem(profile.roleKey, profile.moduleOnly)
    )
  ) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const visitor = await getVisitorRecordById(id);

  if (!visitor) {
    return NextResponse.json({ error: "Visita no encontrada." }, { status: 404 });
  }

  return NextResponse.json(visitor);
}
