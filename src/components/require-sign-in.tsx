"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/** Renders children only when signed in; otherwise a short explanation. */
export function RequireSignIn({ children, what }: { children: React.ReactNode; what: string }) {
  const auth = useAuth();
  if (auth.status === "disabled") {
    return <p className="text-muted">Sign-in is not set up on this site.</p>;
  }
  if (auth.status === "loading") {
    return <div aria-busy="true" aria-label="Loading" className="h-24 animate-pulse rounded-xl bg-border/50" />;
  }
  if (auth.status === "signed-out") {
    return (
      <section className="rounded-xl border border-border p-4">
        <p>Sign in to see {what}.</p>
        <Link href="/login" className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 font-semibold text-white dark:text-black">
          Sign in
        </Link>
      </section>
    );
  }
  return <>{children}</>;
}
