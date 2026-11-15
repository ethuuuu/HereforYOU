import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border-2 border-primary bg-bg text-primary hover:bg-warm",
  danger: "bg-danger text-on-primary hover:opacity-90",
};

/**
 * Shared look for buttons and button-styled links: ≥ 44px tall (48px+ in elder mode), full width on phones.
 * Standard mode lifts on hover and presses in; elder mode keeps only the gentle press.
 */
export function buttonClass(variant: ButtonVariant = "primary", className = ""): string {
  return [
    "inline-flex min-h-(--tap) w-full items-center justify-center gap-2 rounded-md px-5 py-2.5 sm:w-auto",
    "text-base font-bold no-underline elder:px-6 elder:py-3 elder:text-lg",
    "hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.97] active:shadow-none",
    "elder:hover:translate-y-0 elder:hover:shadow-none elder:active:scale-[0.98]",
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
