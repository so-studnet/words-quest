import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Words Quest" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <p>
        <Link href="/" className="text-accent hover:underline">
          ← Words Quest
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <LoginForm />
    </main>
  );
}
