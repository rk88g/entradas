import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, searchInternals } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "8") || 8, 20));

  if (!query) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await searchInternals(query, {
    includeInactive: profile.roleKey === "super-admin",
    limit
  });

  return NextResponse.json({ items }, { status: 200 });
}
