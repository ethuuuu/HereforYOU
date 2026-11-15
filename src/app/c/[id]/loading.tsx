/**
 * Shown the instant a circle section is tapped, while its data streams in.
 * The circle header and nav (layout) stay put, so the click feels immediate.
 */
export default function CircleLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="skeleton h-10 w-2/3 max-w-sm" />
      <div className="skeleton h-32" />
      <div className="skeleton h-32" />
    </div>
  );
}
