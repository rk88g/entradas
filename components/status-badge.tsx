import clsx from "clsx";

export function StatusBadge({
  variant,
  children
}: {
  variant: "ok" | "warn" | "off" | "danger" | "info" | "violet" | "sky" | "amber";
  children: React.ReactNode;
}) {
  return <span className={clsx("status-badge", variant)}>{children}</span>;
}
