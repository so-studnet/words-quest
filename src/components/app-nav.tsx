"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { dueItems, localDate } from "@/lib/domain/study";
import { useStudy } from "@/lib/study-store";

const TABS = [
  { href: "/", label: "Search" },
  { href: "/learned", label: "Learned" },
  { href: "/review", label: "Review" },
] as const;

/** Bottom tab bar, shown only when signed in. */
export function AppNav() {
  const auth = useAuth();
  const studyState = useStudy();
  const pathname = usePathname();
  if (auth.status !== "signed-in") return null;
  const due = studyState.status === "ready" ? dueItems(studyState.data.items, localDate(new Date())).length : 0;

  return (
    <>
      <div className="h-20" aria-hidden="true" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((t) => {
            const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 items-center justify-center gap-1.5 text-base ${active ? "font-semibold text-accent" : "text-muted"}`}
                >
                  {t.label}
                  {t.href === "/review" && due > 0 && (
                    <span className="min-w-6 rounded-full bg-accent px-1.5 text-center text-sm font-semibold text-white dark:text-black">
                      {due}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** "Sign in" link for the home header when signed out. */
export function SignInLink() {
  const auth = useAuth();
  if (auth.status !== "signed-out") return null;
  return (
    <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground">
      Sign in
    </Link>
  );
}
