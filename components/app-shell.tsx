"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  subtitle
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
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
                {open ? "×" : "☰"}
              </button>
            </div>

            <div className={`sidebar-card ${open ? "open" : ""}`}>
              <div className="brand-block">
                <div>
                  <p className="muted" style={{ margin: 0, color: "var(--muted)" }}>
                    Sistema de control
                  </p>
                  <h2 style={{ margin: "0.35rem 0 0" }}>Operación intuitiva y rápida</h2>
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
                  <strong>Flujo recomendado</strong>
                  <p className="mini-copy">
                    Interno → fecha → visitantes → validación → impresión del pase.
                  </p>
                </div>
                <div className="tag-row">
                  <span className="role-badge">super-admin</span>
                  <span className="role-badge">control</span>
                  <span className="role-badge">supervisor</span>
                  <span className="role-badge">capturador</span>
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
                  Operación diaria
                </span>
                <span className="chip">Diseño 100% responsivo</span>
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
                      <span>Vista por defecto</span>
                      <strong>Pases del día siguiente</strong>
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

