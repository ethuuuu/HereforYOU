import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-4xl font-bold text-primary">Sign in</h1>
      <Card className="flex flex-col gap-6">
        <p className="text-xl">Use your Google account. There is no new password to remember.</p>
        <GoogleSignIn />
      </Card>
      <p>
        New here? <Link href="/welcome">Get started</Link> — signing in for the first time creates your account.
      </p>
    </div>
  );
}
