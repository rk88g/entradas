import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

export default async function SistemaLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentUserProfile();

  if (!profile?.active) {
    redirect("/?error=profile");
  }

  return (
    <AppShell
      title="Sistema"
      user={profile}
    >
      {children}
    </AppShell>
  );
}
