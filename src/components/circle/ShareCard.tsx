import { Card } from "@/components/ui/Card";

/** How others join: the circle code plus the passcode (which is never shown again). */
export function ShareCard({ code, elderName, level = 2 }: { code: string; elderName: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Card className="flex flex-col gap-4">
      <Heading className="text-2xl font-bold">Invite family and carers</Heading>
      <p>
        Circle code: <strong className="font-mono text-2xl tracking-wider text-primary">{code}</strong>
      </p>
      <ol className="flex list-decimal flex-col gap-2 pl-6">
        <li>They sign in to Here For YOU.</li>
        <li>They choose who they are, then &ldquo;Join&rdquo;.</li>
        <li>
          They enter the circle code <strong>{code}</strong> and the passcode for {elderName}&rsquo;s circle.
        </li>
      </ol>
      <p className="text-muted">
        Tell them the passcode in person or on the phone. For safety, we never show it again.
      </p>
    </Card>
  );
}
