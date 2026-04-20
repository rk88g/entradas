import { NextResponse } from "next/server";
import { getCurrentUserProfile, getSupportUnreadCount } from "@/lib/supabase/queries";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const count = await getSupportUnreadCount();
  return NextResponse.json({ count }, { status: 200 });
}
