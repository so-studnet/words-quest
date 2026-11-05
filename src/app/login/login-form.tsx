"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signOut, useAuth } from "@/lib/auth";

export function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === "disabled") return <p className="text-muted">Sign-in is not set up on this site.</p>;
  if (auth.status === "loading") return <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-border/50" />;

  if (auth.status === "signed-in") {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <p>
          Signed in as <span className="font-semibold">{auth.email}</span>
        </p>
        <div className="flex gap-2">
          <Link href="/learned" className="rounded-lg bg-accent px-4 py-2 font-semibold text-white dark:text-black">
            Go to Learned
          </Link>
          <button type="button" onClick={() => void signOut()} className="rounded-lg border border-border px-4 py-2">
            Sign out
          </button>
        </div>
      </section>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const message = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    setBusy(false);
    setError(message);
    if (!message) router.push("/learned");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-xl border border-border bg-background px-4 py-3 text-lg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-xl border border-border bg-background px-4 py-3 text-lg outline-none focus:border-accent"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-accent px-5 py-3 text-lg font-semibold text-white disabled:opacity-60 dark:text-black"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-muted">Search works without signing in. Signing in keeps a study log and review schedule.</p>
    </form>
  );
}
