"use client";

import { useEffect, useMemo, useState } from "react";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { HomeDashboardSnapshot, UserProfile } from "@/lib/types";
import { canAccessCoreSystem, canAccessScope } from "@/lib/utils";

const HOME_SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;
const HOME_SUMMARY_CACHE_VERSION = 1;

type CachedHomeDashboardSnapshot = {
  version: number;
  storedAt: number;
  payload: HomeDashboardSnapshot;
};

function buildVisibleStats(user: UserProfile, snapshot: HomeDashboardSnapshot) {
  const canSeeCore = canAccessCoreSystem(user.roleKey, user.moduleOnly);
  const canSeeVisual = canAccessScope(
    user.roleKey,
    user.permissionGrants,
    "visual",
    user.roleKey === "super-admin" || user.accessibleModules.some((item) => item.moduleKey === "visual")
  );
  const canSeeComunicacion = canAccessScope(
    user.roleKey,
    user.permissionGrants,
    "comunicacion",
    user.roleKey === "super-admin" || user.accessibleModules.some((item) => item.moduleKey === "comunicacion")
  );
  const canSeeEscaleras = canAccessScope(
    user.roleKey,
    user.permissionGrants,
    "escaleras",
    user.roleKey === "super-admin" || user.accessibleModules.some((item) => item.moduleKey === "escaleras")
  );

  return [
    ...(user.roleKey === "super-admin" || canSeeCore
      ? [
          { label: "Internos", value: snapshot.internals },
          { label: "Visitas", value: snapshot.visits },
          { label: "Mañana", value: snapshot.openPassCount },
          { label: "En espera", value: snapshot.waitingPassCount }
        ]
      : []),
    ...(canSeeVisual ? [{ label: "Visual", value: snapshot.visual }] : []),
    ...(canSeeComunicacion ? [{ label: "Comunicacion", value: snapshot.comunicacion }] : []),
    ...(canSeeEscaleras ? [{ label: "Escaleras", value: snapshot.escaleras }] : [])
  ];
}

export function HomeDashboard({ user }: { user: UserProfile }) {
  const cacheKey = useMemo(() => `cumplido:home-summary:${user.id}`, [user.id]);
  const [snapshot, setSnapshot] = useState<HomeDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      const now = Date.now();
      let cachedPayload: HomeDashboardSnapshot | null = null;
      let shouldRefresh = true;

      try {
        const rawValue = window.localStorage.getItem(cacheKey);
        if (rawValue) {
          const parsed = JSON.parse(rawValue) as CachedHomeDashboardSnapshot;
          if (parsed?.version === HOME_SUMMARY_CACHE_VERSION && parsed?.payload) {
            cachedPayload = parsed.payload;
            if (active) {
              setSnapshot(parsed.payload);
              setLoading(false);
            }
            shouldRefresh = now - parsed.storedAt >= HOME_SUMMARY_TTL_MS;
          }
        }
      } catch {
        // ignore bad cache
      }

      if (!shouldRefresh) {
        return;
      }

      try {
        if (!cachedPayload && active) {
          setLoading(true);
        }

        const response = await fetch("/api/dashboard-summary", {
          cache: "no-store"
        });

        if (!response.ok) {
          if (active) {
            setLoading(false);
          }
          return;
        }

        const payload = (await response.json()) as HomeDashboardSnapshot;
        if (!active) {
          return;
        }

        setSnapshot(payload);
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({
            version: HOME_SUMMARY_CACHE_VERSION,
            storedAt: Date.now(),
            payload
          } satisfies CachedHomeDashboardSnapshot)
        );
      } catch {
        // ignore and keep stale cache if any
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      active = false;
    };
  }, [cacheKey]);

  const visibleStats = snapshot ? buildVisibleStats(user, snapshot) : [];

  return (
    <>
      <FullscreenLoading active={loading && !snapshot} label="Loading..." />
      <section className="stats-grid">
        {visibleStats.map((item) => (
          <article key={item.label} className="stat-card">
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>
    </>
  );
}
