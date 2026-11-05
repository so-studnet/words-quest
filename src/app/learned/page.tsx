import type { Metadata } from "next";
import { RequireSignIn } from "@/components/require-sign-in";
import { LearnedView } from "./learned-view";

export const metadata: Metadata = { title: "Learned · Words Quest" };

export default function LearnedPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Learned</h1>
      <RequireSignIn what="what you have learned">
        <LearnedView />
      </RequireSignIn>
    </main>
  );
}
