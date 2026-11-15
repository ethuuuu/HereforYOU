import { useId, type InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Shown under the label, e.g. "Like 8:00 AM". */
  hint?: string;
  /** Says what to fix, e.g. "Enter the time like 8:00 AM". */
  error?: string;
};

/** Labelled text input. Hint and error are linked with aria-describedby. */
export function Field({ label, hint, error, id, className = "", ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-lg font-bold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-muted">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`min-h-12 rounded-xl border-2 bg-bg px-4 py-2 text-lg ${error ? "border-danger" : "border-field"} ${className}`}
        {...input}
      />
      {error && (
        <p id={errorId} className="font-bold text-danger">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </div>
  );
}
