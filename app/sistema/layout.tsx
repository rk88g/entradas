import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserProfile, getSupportUnreadCount } from "@/lib/supabase/queries";

export default async function SistemaLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [profile, supportUnreadCount] = await Promise.all([
    getCurrentUserProfile(),
    getSupportUnreadCount()
  ]);

  if (!profile?.active) {
    redirect("/?error=profile");
  }

  return (
    <AppShell
      title="Sistema"
      user={profile}
      supportUnreadCount={supportUnreadCount}
    >
      {children}
    </AppShell>
  );
}
