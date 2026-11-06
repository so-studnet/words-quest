import type { Metadata } from "next";
import Link from "next/link";
import { KeyGenerator } from "./key-generator";

export const metadata: Metadata = {
  title: "Notification keys · Words Quest",
  robots: { index: false },
};

export default function KeysPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:py-12">
      <p>
        <Link href="/" className="text-accent hover:underline">
          ← Words Quest
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Notification keys</h1>
      <p className="text-muted">
        For the site owner: makes the keys for push notifications. They are created in this browser and are never sent
        anywhere. Copy each one into Vercel, then close this page.
      </p>
      <KeyGenerator />
    </main>
  );
}
