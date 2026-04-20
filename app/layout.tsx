import type { Metadata } from "next";
import { UiRuntime } from "@/components/ui-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Cumplido desde 2020",
  description: "Sistema responsivo para captura y control de pases de visita."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <UiRuntime />
        {children}
      </body>
    </html>
  );
}
