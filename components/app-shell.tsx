"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { UserProfile } from "@/lib/types";

const navItems = [
  { href: "/sistema", icon: "IN", label: "Inicio" },
  { href: "/sistema/internos", icon: "IT", label: "Interno" },
  { href: "/sistema/visitas", icon: "VS", label: "Visitas" },
  { href: "/sistema/listado", icon: "LS", label: "Listado" },
  { href: "/sistema/fechas", icon: "FC", label: "Fechas" }
];

export function AppShell({
  children,
  title,
  subtitle,
  user
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  user: UserProfile;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="page-bg">
      <div className="page-shell app-shell">
        <aside className="app-sidebar">
          <div className="glass-panel app-panel hide-print">
            <div className="mobile-topbar">
              <div className="brand-block">
                <span className="brand-mark">EN</span>
                <div>
                  <strong>Entradas</strong>
                  <div className="muted" style={{ color: "var(--muted)" }}>
                    Terraza y pases INTIMA
                  </div>
                </div>
              </div>
              <button className="mobile-toggle" onClick={() => setOpen((value) => !value)}>
                {open ? "x" : "="}
              </button>
            </div>

            <div className={`sidebar-card ${open ? "open" : ""}`}>
              <div className="brand-block">
                <div>
                  <p className="muted" style={{ margin: 0, color: "var(--muted)" }}>
                    Sistema de control
                  </p>
                  <h2 style={{ margin: "0.35rem 0 0" }}>Operacion intuitiva y rapida</h2>
                </div>
              </div>

              <nav className="nav-list">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link ${active ? "active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="icon-pill">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="stack">
                <div className="note-box">
                  <strong>{user.fullName}</strong>
                  <p className="mini-copy">
                    {user.roleName} · {user.email}
                  </p>
                </div>
                <div className="tag-row">
                  <span className="role-badge">{user.roleKey}</span>
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="app-main">
          <section className="app-panel">
            <div className="app-header">
              <div className="header-actions">
                <span className="eyebrow" style={{ color: "#0f766e", background: "#d9f2ef" }}>
                  Operacion diaria
                </span>
                <span className="chip">Diseno 100% responsivo</span>
              </div>
              <div className="header-grid">
                <div className="stack">
                  <div className="record-title">
                    <strong className="module-title">{title}</strong>
                    <span>{subtitle}</span>
                  </div>
                </div>
                <div className="data-card hide-print">
                  <div className="mini-list">
                    <div className="mini-row">
                      <span>Usuario activo</span>
                      <strong>{user.fullName}</strong>
                    </div>
                    <div className="mini-row">
                      <span>Vista por defecto</span>
                      <strong>Pases del dia siguiente</strong>
                    </div>
                    <div className="mini-row">
                      <span>Control visual</span>
                      <strong>Menores &lt; 12 en rojo</strong>
                    </div>
                    <div className="mini-row">
                      <span>Bloqueo</span>
                      <strong>Betadas sin acceso</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}

