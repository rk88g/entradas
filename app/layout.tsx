import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entradas | Control de Visitas",
  description: "Sistema responsivo para captura y control de pases de visita."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

