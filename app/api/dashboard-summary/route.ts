import { NextResponse } from "next/server";
import { getCurrentUserProfile, getHomeDashboardSnapshot } from "@/lib/supabase/queries";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json(
      {
        internals: 0,
        visits: 0,
        openPassCount: 0,
        waitingPassCount: 0,
        visual: 0,
        comunicacion: 0,
        escaleras: 0,
        generatedAt: new Date().toISOString()
      },
      { status: 200 }
    );
  }

  const snapshot = await getHomeDashboardSnapshot();
  return NextResponse.json(snapshot, { status: 200 });
}
