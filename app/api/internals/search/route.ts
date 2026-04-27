import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile, getInternalSearchOptionById, searchInternals } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const internalId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "8") || 8, 20));

  if (internalId) {
    const item = await getInternalSearchOptionById(internalId, {
      includeInactive: profile.roleKey === "super-admin"
    });

    return NextResponse.json({ items: item ? [item] : [] }, { status: 200 });
  }

  if (!query) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const items = await searchInternals(query, {
    includeInactive: profile.roleKey === "super-admin",
    limit
  });

  return NextResponse.json({ items }, { status: 200 });
}
