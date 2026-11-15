import type { HTMLAttributes } from "react";

/** Large, rounded, warm surface for grouping content. */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border-2 border-line bg-surface p-6 shadow-sm sm:p-8 ${className}`} {...rest} />;
}
