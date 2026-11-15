import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/circle/CodeForms";
import { Card } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Confirm your care circle" };

export default async function ClaimPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div>
        <nav aria-label="Setup steps">
          <Link href="/welcome" className="text-base text-primary">
            ← Back
          </Link>
        </nav>
        <h1 className="mt-4 text-4xl font-bold text-primary">Confirm your care circle</h1>
        <p className="mt-3 text-xl">
          A family member or carer set up a care circle for you. Enter the codes they gave you to
          take ownership of it.
        </p>
      </div>

      <Card>
        <ClaimForm />
      </Card>

      <p className="text-muted">
        Don&rsquo;t have a code?{" "}
        <Link href="/welcome/elder">Create your own care circle instead</Link>.
      </p>
    </div>
  );
}
