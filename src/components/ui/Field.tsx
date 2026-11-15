import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

type Described = {
  label: string;
  /** Shown under the label, e.g. "Like 8:00 AM". */
  hint?: string;
  /** Says what to fix, e.g. "Enter the time like 8:00 AM". */
  error?: string;
};

const CONTROL = "min-h-(--tap) rounded-lg border-2 bg-bg px-3 py-2 text-base elder:px-4 elder:text-lg";

/** Label + hint + control + error, wired with aria-describedby / aria-invalid. */
function Wrapper({
  label,
  hint,
  error,
  id,
  control,
}: Described & { id?: string; control: (a11y: { id: string; describedBy?: string; invalid?: true }) => ReactNode }) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5 elder:gap-2">
      <label htmlFor={controlId} className="font-bold elder:text-lg">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {control({ id: controlId, describedBy, invalid: error ? true : undefined })}
      {error && (
        <p id={errorId} className="font-bold text-danger">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </div>
  );
}

/** Labelled text input. */
export function Field({ label, hint, error, id, className = "", ...input }: Described & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Wrapper
      {...{ label, hint, error, id }}
      control={(a) => (
        <input
          id={a.id}
          aria-describedby={a.describedBy}
          aria-invalid={a.invalid}
          className={`${CONTROL} ${error ? "border-danger" : "border-field"} ${className}`}
          {...input}
        />
      )}
    />
  );
}

/** Labelled select. */
export function SelectField({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...select
}: Described & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Wrapper
      {...{ label, hint, error, id }}
      control={(a) => (
        <select
          id={a.id}
          aria-describedby={a.describedBy}
          aria-invalid={a.invalid}
          className={`${CONTROL} ${error ? "border-danger" : "border-field"} ${className}`}
          {...select}
        >
          {children}
        </select>
      )}
    />
  );
}
