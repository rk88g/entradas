import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, searchVisitors } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active || profile.roleKey !== "super-admin") {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "8") || 8, 20));

  if (!query) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await searchVisitors(query, { limit });
  return NextResponse.json({ items }, { status: 200 });
}
