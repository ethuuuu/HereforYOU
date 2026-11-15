import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClaimForm, JoinCircleForm } from "@/components/circle/CodeForms";
import { CreateCircleForm } from "@/components/circle/CreateCircleForm";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth/session";
import { SETUP_ROLES, type SetupRole } from "@/lib/domain/schemas";

type Params = { role: string };

export async function generateMetadata({ params }: PageProps<"/welcome/[role]">): Promise<Metadata> {
  const { role } = await params;
  const titles: Record<SetupRole, string> = {
    elder: "Create your circle",
    family: "Set up for a family member",
    caretaker: "Join or create a circle",
    doctor: "Join a care circle",
  };
  const isValid = (SETUP_ROLES as readonly string[]).includes(role);
  return { title: isValid ? titles[role as SetupRole] : "Get started" };
}

const HEADINGS: Record<SetupRole, { title: string; intro: string }> = {
  elder: {
    title: "Create your care circle",
    intro:
      "You will be in charge. Family and carers join with a code — you decide what they can see and do.",
  },
  family: {
    title: "Set up a care circle for your family member",
    intro:
      "Enter their name and choose a passcode. When you're done, hand the phone to them so they can confirm.",
  },
  caretaker: {
    title: "Join or create a care circle",
    intro:
      "If the circle already exists, join it with the code and passcode. Otherwise, create one for your client.",
  },
  doctor: {
    title: "Join a care circle",
    intro: "Enter the circle code and passcode to view the medicines and appointments.",
  },
};

const NAME_LABELS: Record<SetupRole, string> = {
  elder: "Your name",
  family: "Their name (the elder)",
  caretaker: "The elder's name",
  doctor: "The elder's name",
};

export default async function WelcomeRolePage({ params }: PageProps<"/welcome/[role]">) {
  const { role } = await params;
  if (!(SETUP_ROLES as readonly string[]).includes(role)) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/signin");

  const setupRole = role as SetupRole;
  const { title, intro } = HEADINGS[setupRole];
  const isElder = setupRole === "elder";
  const isDoctor = setupRole === "doctor";

  // Doctors can only join; caretakers and family can join or create.
  const showJoin = !isElder;
  const showCreate = !isDoctor;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div>
        <nav aria-label="Setup steps">
          <Link href="/welcome" className="text-base text-primary">
            ← Back
          </Link>
        </nav>
        <h1 className="mt-4 text-4xl font-bold text-primary">{title}</h1>
        <p className="mt-3 text-xl">{intro}</p>
      </div>

      {/* Elder: single create form */}
      {isElder && (
        <Card>
          <CreateCircleForm setupRole="elder" nameLabel={NAME_LABELS.elder} />
        </Card>
      )}

      {/* Doctor: single join form */}
      {isDoctor && (
        <Card>
          <JoinCircleForm setupRole="doctor" defaultName={user.name} />
        </Card>
      )}

      {/* Family & caretaker: create or join */}
      {!isElder && !isDoctor && (
        <div className="flex flex-col gap-6">
          {showCreate && (
            <Card>
              <h2 className="mb-6 text-2xl font-bold">Create a new circle</h2>
              <CreateCircleForm setupRole={setupRole} nameLabel={NAME_LABELS[setupRole]} />
            </Card>
          )}

          {showCreate && showJoin && (
            <p className="text-center text-xl font-bold text-muted">— or —</p>
          )}

          {showJoin && (
            <Card>
              <h2 className="mb-6 text-2xl font-bold">Join an existing circle</h2>
              <JoinCircleForm setupRole={setupRole} defaultName={user.name} />
            </Card>
          )}
        </div>
      )}

      {/* Elder claim hint (shown on family setup page) */}
      {setupRole === "family" && (
        <p className="text-muted">
          Already have a confirmation code?{" "}
          <Link href="/claim">Confirm the circle as the elder</Link>
        </p>
      )}
    </div>
  );
}
