import { redirect } from "next/navigation";
import { InternalBrowser } from "@/components/internal-browser";
import {
  getCurrentUserProfile,
  getListingBuilderData
} from "@/lib/supabase/queries";

export default async function InternosPage() {
  const [profile] = await Promise.all([getCurrentUserProfile()]);
  const builderData = await getListingBuilderData(profile?.roleKey === "super-admin");

  if (profile?.moduleOnly && profile.accessibleModules.length > 0) {
    redirect(`/sistema/${profile.accessibleModules[0].moduleKey}`);
  }

  return (
    <InternalBrowser
      profiles={builderData.internalProfiles}
      nextDate={builderData.nextDate}
      openDate={builderData.openDate}
      passArticles={builderData.passArticles}
      roleKey={profile?.roleKey ?? "capturador"}
    />
  );
}
