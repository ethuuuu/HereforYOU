import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/data/users";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { PasskeySignIn } from "@/components/passkeys/PasskeySignIn";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) redirect(await homePathFor(user.uid)); // already signed in
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-4xl font-bold text-primary">Sign in</h1>
      <Card className="flex flex-col gap-6">
        <p className="text-xl">Use your fingerprint, your face or your Google account. There is no password to remember.</p>
        <PasskeySignIn />
        <GoogleSignIn />
      </Card>
      <p>
        New here? <Link href="/welcome">Get started</Link> — signing in for the first time creates your account.
      </p>
    </div>
  );
}
