import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border-2 border-primary bg-bg text-primary hover:bg-warm",
  danger: "bg-danger text-white hover:opacity-90",
};

/** Shared look for buttons and button-styled links: ≥ 48px tall, full width on phones. */
export function buttonClass(variant: ButtonVariant = "primary", className = ""): string {
  return [
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 py-3",
    "text-lg font-bold no-underline transition-colors sm:w-auto",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    className,
  ].join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
};

export function Button({
  variant = "primary",
  loading = false,
  loadingText = "Please wait…",
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, className)}
      {...rest}
    >
      {loading ? loadingText : children}
    </button>
  );
}
