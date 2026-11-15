import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { PasskeyCreateAccount } from "@/components/passkeys/PasskeyCreateAccount";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Get started" };

const ROLES = [
  {
    id: "elder",
    icon: "🧑‍🦳",
    title: "It's for me",
    subtitle: "I am the elder",
    description: "Create your own care circle. You'll be in charge.",
    href: "/welcome/elder",
  },
  {
    id: "family",
    icon: "👪",
    title: "It's for a family member",
    subtitle: "Child, sibling or other relative",
    description: "Set up a circle for someone you love. They'll confirm it on their device.",
    href: "/welcome/family",
  },
  {
    id: "caretaker",
    icon: "🤝",
    title: "I'm a caretaker",
    subtitle: "Professional or personal carer",
    description: "Join an existing circle, or create one for a client.",
    href: "/welcome/caretaker",
  },
  {
    id: "doctor",
    icon: "🩺",
    title: "I'm a doctor",
    subtitle: "Medical professional",
    description: "Join a care circle to view prescriptions and add appointments.",
    href: "/welcome/doctor",
  },
] as const;

export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) return <CreateAccount />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold text-primary">Who is this for?</h1>
        <p className="mt-3 text-xl text-muted">
          Tell us your role so we can show you the right steps.
        </p>
      </div>

      <ul className="flex flex-col gap-4" role="list">
        {ROLES.map((role) => (
          <li key={role.id}>
            <Link
              href={role.href}
              className={`${buttonClass("secondary")} h-auto w-full flex-col items-start gap-1 rounded-lg px-6 py-5 text-left sm:flex-row sm:items-center sm:gap-6`}
            >
              <span aria-hidden="true" className="text-4xl">
                {role.icon}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-xl font-bold">{role.title}</span>
                <span className="text-base font-normal text-muted">{role.subtitle}</span>
                <span className="text-base font-normal text-muted">{role.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Signed out: make an account first — with a passkey, or with Google. */
function CreateAccount() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-4xl font-bold text-primary">Create your account</h1>
      <Card className="flex flex-col gap-6">
        <PasskeyCreateAccount />
        <GoogleSignIn />
      </Card>
      <p>
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </div>
  );
}
