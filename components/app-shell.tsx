"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfile } from "@/lib/types";
import { canAccessCoreSystem, canAccessModule, canAccessScope } from "@/lib/utils";

const coreNavItems = [
  { href: "/sistema", icon: "IN", label: "Inicio", scopeKey: "inicio" },
  { href: "/sistema/internos", icon: "IT", label: "Internos", scopeKey: "internos" },
  { href: "/sistema/visitas", icon: "VS", label: "Visitas", scopeKey: "visitas" },
  { href: "/sistema/listado", icon: "LS", label: "Listado", scopeKey: "listado" },
  { href: "/sistema/fechas", icon: "FC", label: "Fechas", scopeKey: "fechas" }
];

const moduleNavItems = [
  { href: "/sistema/visual", icon: "VI", label: "Visual", moduleKey: "visual" as const, scopeKey: "visual" },
  { href: "/sistema/comunicacion", icon: "CO", label: "Comunicacion", moduleKey: "comunicacion" as const, scopeKey: "comunicacion" },
  { href: "/sistema/escaleras", icon: "ES", label: "Escaleras", moduleKey: "escaleras" as const, scopeKey: "escaleras" },
  { href: "/sistema/aduana", icon: "AD", label: "Aduana", moduleKey: "escaleras" as const, scopeKey: "aduana" }
];

export function AppShell({
  children,
  title,
  user
}: {
  children: React.ReactNode;
  title: string;
  user: UserProfile;
}) {
  const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingHref, setLoadingHref] = useState<string | null>(null);
  const idleLogoutFormRef = useRef<HTMLFormElement | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleNavItems = [
    ...(canAccessCoreSystem(user.roleKey, user.moduleOnly)
      ? coreNavItems.filter((item) =>
          canAccessScope(
            user.roleKey,
            user.permissionGrants,
            item.scopeKey,
            true
          )
        )
      : []),
    ...(user.roleKey === "super-admin"
      ? [{ href: "/sistema/admin", icon: "DZ", label: "Danger Zone", danger: true, scopeKey: "danger-zone" }]
      : []),
    ...moduleNavItems.filter((item) => {
      return canAccessScope(
        user.roleKey,
        user.permissionGrants,
        item.scopeKey,
        canAccessModule(user.roleKey, user.accessibleModules, item.moduleKey)
      );
    })
  ];

  useEffect(() => {
    setLoadingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (user.roleKey === "super-admin") {
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        idleLogoutFormRef.current?.requestSubmit();
      }, IDLE_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [pathname, user.roleKey]);

  function handleNavigate(href: string) {
    if (href === pathname) {
      setOpen(false);
      return;
    }

    setLoadingHref(href);
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="page-bg">
      <div className="page-shell app-shell">
        <aside className="app-sidebar">
          <div className="glass-panel app-panel hide-print">
            <div className="mobile-topbar">
              <div className="brand-block">
                <span className="brand-mark">RK</span>
                <div>
                  <strong>{user.fullName}</strong>
                </div>
              </div>
              <button className="mobile-toggle" onClick={() => setOpen((value) => !value)}>
                {open ? "x" : "="}
              </button>
            </div>

            <div className={`sidebar-card ${open ? "open" : ""}`}>
              <nav className="nav-list">
                {visibleNavItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <button
                      type="button"
                      key={item.href}
                      className={`nav-link ${active ? "active" : ""} ${"danger" in item && item.danger ? "danger-link" : ""}`}
                      onClick={() => handleNavigate(item.href)}
                    >
                      <span className="icon-pill">{item.icon}</span>
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="tag-row">
                <span className="role-badge">{user.roleKey}</span>
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <main className="app-main">
          {user.roleKey !== "super-admin" ? <form action={signOutAction} ref={idleLogoutFormRef} hidden /> : null}
          <section className="app-panel hide-print">
            <div className="app-header-bar">
              <strong className="module-title">Sistema Cumplido desde 2020</strong>
              <ThemeToggle />
            </div>
          </section>
          {loadingHref ? (
            <div className="page-loading-scrim hide-print">
              <div className="page-loading-card">
                <span className="loading-spinner" />
                <strong>Loading...</strong>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
