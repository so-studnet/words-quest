"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut, useAuth } from "@/lib/auth";
import { dailySummary, localDate, logByDay, MASTERED_STAGE, studyStats, type DaySummary } from "@/lib/domain/study";
import { dayLabel, shortDate } from "@/lib/format-date";
import { study, useStudy } from "@/lib/study-store";

const CHART_DAYS = 30;

export function LearnedView() {
  const s = useStudy();
  const auth = useAuth();
  if (s.status === "off" || (s.status === "loading" && s.data.items.length === 0)) {
    return <div aria-busy="true" aria-label="Loading" className="h-40 animate-pulse rounded-xl bg-border/50" />;
  }
  const today = localDate(new Date());
  const stats = studyStats(s.data, today);
  const log = logByDay(s.data);

  return (
    <div className="flex flex-col gap-6">
      {s.status === "error" && (
        <p role="alert" className="rounded-xl border border-red-600/40 p-3 text-sm">
          {s.message}{" "}
          <button type="button" onClick={() => study.reload()} className="font-semibold underline">
            Reload
          </button>
        </p>
      )}

      <section aria-label="Today" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Learned today" value={stats.learnedToday} />
        <Stat label="Reviewed today" value={stats.reviewedToday} />
        <Stat label="Due now" value={stats.dueToday} href={stats.dueToday > 0 ? "/review" : undefined} />
        <Stat label="Day streak" value={stats.streak} />
      </section>
      <p className="-mt-3 text-sm text-muted">
        {stats.total} {stats.total === 1 ? "entry" : "entries"} in total · {stats.mastered} mastered
      </p>

      <LearnedChart days={dailySummary(s.data, today, CHART_DAYS)} />

      <section aria-label="By day" className="flex flex-col gap-5">
        {log.length === 0 && (
          <p className="text-muted">
            Nothing yet. <Link href="/" className="text-accent hover:underline">Look something up</Link> and it will
            appear here.
          </p>
        )}
        {log.map((day) => (
          <div key={day.date}>
            <h2 className="flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-muted">
              <span>{dayLabel(day.date, today)}</span>
              <span className="font-normal normal-case">
                {day.items.length} {day.items.length === 1 ? "entry" : "entries"}
              </span>
            </h2>
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {day.items.map(({ item, isNew }) => (
                <LogRow key={item.id} id={item.id} text={item.text} isNew={isNew} mastered={item.stage >= MASTERED_STAGE} dueOn={item.dueOn} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {auth.status === "signed-in" && (
        <p className="text-sm text-muted">
          Signed in as {auth.email} ·{" "}
          <button type="button" onClick={() => void signOut()} className="underline hover:text-foreground">
            Sign out
          </button>
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </>
  );
  const cls = "flex flex-col gap-1 rounded-xl border border-border p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** One series: entries learned per day. Tap or hover a bar for the numbers. */
function LearnedChart({ days }: { days: DaySummary[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.learned));
  const shown = active === null ? null : days[active];
  const total = days.reduce((n, d) => n + d.learned, 0);

  return (
    <section aria-label={`Entries learned, last ${days.length} days`} className="rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Learned · last {days.length} days</h2>
        <p className="text-sm text-muted tabular-nums" aria-live="polite">
          {shown ? `${shortDate(shown.date)}: ${shown.learned} learned, ${shown.reviewed} reviewed` : `${total} total`}
        </p>
      </div>
      <div className="mt-4 flex h-32 items-end gap-[2px] border-b border-border" onMouseLeave={() => setActive(null)}>
        {days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            aria-label={`${shortDate(d.date)}: ${d.learned} learned, ${d.reviewed} reviewed`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={`block w-full rounded-t-[4px] ${active === i ? "bg-accent" : "bg-accent/70 group-hover:bg-accent"}`}
              style={{ height: d.learned === 0 ? 0 : `${Math.max(4, (d.learned / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{shortDate(days[0].date)}</span>
        <span>Today</span>
      </div>
    </section>
  );
}

function LogRow({ id, text, isNew, mastered, dueOn }: { id: string; text: string; isNew: boolean; mastered: boolean; dueOn: string | null }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex items-center gap-2">
      <Link href={`/?q=${encodeURIComponent(text)}`} className="min-w-0 flex-1 truncate py-3 pl-4">
        {text}
      </Link>
      {isNew && <span className="rounded-full border border-border px-2 text-xs text-muted">New</span>}
      <span className="text-xs text-muted tabular-nums" title={mastered ? "Mastered" : `Next review ${dueOn}`}>
        {mastered ? "Mastered" : dueOn ? `Review ${shortDate(dueOn)}` : ""}
      </span>
      <button
        type="button"
        onClick={() => (confirming ? study.remove(id) : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        aria-label={confirming ? `Tap again to delete ${text}` : `Delete ${text}`}
        className={`px-4 py-3 text-sm ${confirming ? "font-semibold text-red-700 dark:text-red-400" : "text-muted hover:text-foreground"}`}
      >
        {confirming ? "Delete?" : "×"}
      </button>
    </li>
  );
}
