"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { UserProfile } from "@/lib/types";
import { canAccessCoreSystem, canAccessModule } from "@/lib/utils";

const coreNavItems = [
  { href: "/sistema", icon: "IN", label: "Inicio" },
  { href: "/sistema/internos", icon: "IT", label: "Internos" },
  { href: "/sistema/visitas", icon: "VS", label: "Visitas" },
  { href: "/sistema/listado", icon: "LS", label: "Listado" },
  { href: "/sistema/fechas", icon: "FC", label: "Fechas" }
];

const moduleNavItems = [
  { href: "/sistema/visual", icon: "VI", label: "Visual", moduleKey: "visual" as const },
  { href: "/sistema/comunicacion", icon: "CO", label: "Comunicacion", moduleKey: "comunicacion" as const },
  { href: "/sistema/escaleras", icon: "ES", label: "Escaleras", moduleKey: "escaleras" as const }
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNavItems = [
    ...(canAccessCoreSystem(user.roleKey, user.moduleOnly) ? coreNavItems : []),
    ...(user.roleKey === "super-admin"
      ? [{ href: "/sistema/admin", icon: "DZ", label: "Danger Zone", danger: true }]
      : []),
    ...moduleNavItems.filter((item) => canAccessModule(user.roleKey, user.accessibleModules, item.moduleKey))
  ];

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
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link ${active ? "active" : ""} ${"danger" in item && item.danger ? "danger-link" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="icon-pill">{item.icon}</span>
                      {item.label}
                    </Link>
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
          <section className="app-panel hide-print">
            <div className="record-title">
              <strong className="module-title">Sistema Cumplido desde 2020</strong>
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
