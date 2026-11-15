import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/data/users";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const BENEFITS = [
  {
    icon: "💊",
    title: "Never miss a dose",
    text: "A friendly email before each medicine, and a gentle check if one is missed.",
  },
  {
    icon: "👪",
    title: "Family stays in the loop",
    text: "Family and carers join with a private code and passcode. They are told only when you might need help.",
  },
  {
    icon: "🧭",
    title: "You stay in charge",
    text: "You choose who joins and what they can do, and you see every change anyone makes.",
  },
];

/** Signed-in people go straight to their circle (or setup if they have none); everyone else sees the intro. */
export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(await homePathFor(user.uid));
  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="intro" className="rounded-lg bg-warm px-6 py-10 sm:px-10 sm:py-14">
        <h1 id="intro" className="text-4xl font-bold leading-tight text-primary sm:text-5xl">
          Here For YOU
        </h1>
        <p className="mt-4 max-w-2xl text-xl sm:text-2xl">
          Your medicines, doctor visits and family — together in one place, with you in charge.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link href="/welcome" className={buttonClass("primary", "text-xl")}>
            Get started
          </Link>
          <Link href="/signin" className={buttonClass("secondary", "text-xl")}>
            Sign in
          </Link>
        </div>
      </section>

      <section aria-labelledby="benefits">
        <h2 id="benefits" className="text-3xl font-bold">
          How it helps
        </h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <Card className="h-full">
                <span aria-hidden="true" className="text-4xl">
                  {b.icon}
                </span>
                <h3 className="mt-3 text-2xl font-bold">{b.title}</h3>
                <p className="mt-2 text-muted">{b.text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
