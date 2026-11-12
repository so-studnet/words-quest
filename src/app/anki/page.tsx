import type { Metadata } from "next";
import Link from "next/link";
import { RequireSignIn } from "@/components/require-sign-in";
import { AnkiExportView } from "./anki-export-view";

export const metadata: Metadata = { title: "Anki · Words Quest" };

export default function AnkiPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <p>
        <Link href="/learned" className="text-accent hover:underline">
          ← Learned
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Send to Anki</h1>
      <RequireSignIn what="your study log">
        <AnkiExportView />
      </RequireSignIn>
    </main>
  );
}
