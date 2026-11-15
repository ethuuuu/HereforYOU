/** Re-mounts on every navigation inside a circle, so each section eases in (off with Reduce motion). */
export default function CircleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-enter">{children}</div>;
}
