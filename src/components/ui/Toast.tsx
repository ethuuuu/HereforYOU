export type ToastTone = "success" | "error" | "info";

const STYLE: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: "✓", className: "border-success text-success" },
  error: { icon: "!", className: "border-danger text-danger" },
  info: { icon: "i", className: "border-primary text-primary" },
};

/**
 * Polite live region for results. Keep it rendered (even when empty) so screen
 * readers are already watching it when a message appears.
 */
export function Toast({ message, tone = "info" }: { message?: string | null; tone?: ToastTone }) {
  const { icon, className } = STYLE[tone];
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <p className={`flex items-start gap-3 rounded-2xl border-2 bg-surface px-5 py-4 font-bold ${className}`}>
          <span aria-hidden="true">{icon}</span>
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
