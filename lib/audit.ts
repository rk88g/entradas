import "server-only";

import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

type ConnectionLogPayload = {
  userId?: string | null;
  email: string;
  success: boolean;
  failureReason?: string | null;
};

type AuditPayload = {
  userId: string;
  moduleKey: string;
  sectionKey: string;
  actionKey: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
};

async function getRequestMeta() {
  const requestHeaders = await headers();
  return {
    ipAddress:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip") ??
      requestHeaders.get("cf-connecting-ip") ??
      null,
    userAgent: requestHeaders.get("user-agent") ?? null,
    country:
      requestHeaders.get("x-vercel-ip-country") ??
      requestHeaders.get("cf-ipcountry") ??
      null,
    region:
      requestHeaders.get("x-vercel-ip-country-region") ??
      null,
    city:
      requestHeaders.get("x-vercel-ip-city") ??
      null
  };
}

export async function logConnectionEvent(payload: ConnectionLogPayload) {
  if (!isSupabaseAdminConfigured()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    const meta = await getRequestMeta();
    await admin.from("connection_logs").insert({
      user_profile_id: payload.userId ?? null,
      email: payload.email,
      success: payload.success,
      failure_reason: payload.failureReason ?? null,
      ip_address: meta.ipAddress,
      user_agent: meta.userAgent,
      country: meta.country,
      region: meta.region,
      city: meta.city
    });
  } catch {
    // Silent by design: audit logging should not block auth flow.
  }
}

export async function logAuditEvent(payload: AuditPayload) {
  if (!isSupabaseAdminConfigured()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("action_audit_logs").insert({
      user_profile_id: payload.userId,
      module_key: payload.moduleKey,
      section_key: payload.sectionKey,
      action_key: payload.actionKey,
      entity_type: payload.entityType,
      entity_id: payload.entityId ?? null,
      before_data: payload.beforeData ?? null,
      after_data: payload.afterData ?? null
    });
  } catch {
    // Silent by design: audit logging should not block user actions.
  }
}
