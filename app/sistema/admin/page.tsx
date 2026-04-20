import { redirect } from "next/navigation";
import { AdminControlPanel } from "@/components/admin-control-panel";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getAdminPanelData, getCurrentUserProfile } from "@/lib/supabase/queries";

export default async function AdminPage() {
  const profile = await getCurrentUserProfile();

  if (!profile?.active || profile.roleKey !== "super-admin") {
    redirect("/sistema");
  }

  const data = await getAdminPanelData();

  return (
    <AdminControlPanel
      connectionLogs={data.connectionLogs}
      actionLogs={data.actionLogs}
      users={data.users}
      config={data.config}
      adminConfigured={isSupabaseAdminConfigured()}
    />
  );
}
