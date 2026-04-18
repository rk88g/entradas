import { AppShell } from "@/components/app-shell";

export default function SistemaLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell
      title="Centro de operación de pases"
      subtitle="Listo para una captura ágil, validación de betadas y visualización diaria de ingresos."
    >
      {children}
    </AppShell>
  );
}

