"use client";

export function LoadingButton({
  pending,
  label,
  loadingLabel = "Loading...",
  className = "button",
  type = "submit",
  disabled = false
}: {
  pending: boolean;
  label: string;
  loadingLabel?: string;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={`${className} ${pending ? "is-loading" : ""}`.trim()}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? (
        <span className="loading-inline">
          <span className="loading-spinner" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
