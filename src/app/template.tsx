/** Re-mounts when the top-level section changes, so each page eases in (off with Reduce motion). */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade">{children}</div>;
}
