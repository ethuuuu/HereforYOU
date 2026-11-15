import type { HTMLAttributes } from "react";

/** Rounded glass surface for grouping content. Roomier in elder mode. */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`lift rounded-lg border-2 border-line glass p-5 shadow-sm sm:p-6 elder:p-6 elder:sm:p-8 ${className}`} {...rest} />;
}
