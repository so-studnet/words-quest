"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NOTIFY_HOUR,
  disablePush,
  enablePush,
  getPushStatus,
  isPushConfigured,
  isPushSupported,
  needsHomeScreenInstall,
  setPushHour,
  type PushStatus,
} from "@/lib/push-client";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

type View =
  | { kind: "loading" }
  | { kind: "install" } // iPhone, not added to the Home Screen
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "ready"; status: PushStatus };

/** "Word of the Day" push settings for this device. Hidden when push is not configured. */
export function NotificationSettings() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [hour, setHour] = useState(DEFAULT_NOTIFY_HOUR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: View;
      if (needsHomeScreenInstall()) next = { kind: "install" };
      else if (!isPushSupported()) next = { kind: "unsupported" };
      else if (Notification.permission === "denied") next = { kind: "blocked" };
      else {
        try {
          const status = await getPushStatus();
          next = { kind: "ready", status };
          if (status.subscribed && !cancelled) setHour(status.hour);
        } catch {
          next = { kind: "ready", status: { subscribed: false } };
        }
      }
      if (!cancelled) setView(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isPushConfigured) return null;

  async function run(action: () => Promise<View>) {
    setBusy(true);
    setError(null);
    try {
      setView(await action());
    } catch (e) {
      console.error("[push]", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const on = view.kind === "ready" && view.status.subscribed;

  return (
    <section aria-label="Notifications" className="rounded-xl border border-border p-4">
      <h2 className="font-semibold">Word of the Day</h2>
      <p className="mt-1 text-sm text-muted">Get one useful word on this device every day.</p>

      {view.kind === "loading" && <div className="mt-3 h-10 animate-pulse rounded-lg bg-border/50" />}
      {view.kind === "install" && (
        <p className="mt-3 text-sm">
          On iPhone, tap <span className="font-semibold">Share</span> →{" "}
          <span className="font-semibold">Add to Home Screen</span>, then open Words Quest from the Home Screen to
          turn on notifications.
        </p>
      )}
      {view.kind === "unsupported" && <p className="mt-3 text-sm">This browser does not support notifications.</p>}
      {view.kind === "blocked" && (
        <p className="mt-3 text-sm">Notifications are blocked for this site. Allow them in your browser settings.</p>
      )}

      {view.kind === "ready" && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm">Time</span>
            <select
              value={hour}
              disabled={busy}
              onChange={(e) => {
                const h = Number(e.target.value);
                setHour(h);
                if (on) void run(async () => (await setPushHour(h), { kind: "ready", status: { subscribed: true, hour: h } }));
              }}
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          {on ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-semibold">On</span> · every day at {hourLabel(hour)}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(async () => (await disablePush(), { kind: "ready", status: { subscribed: false } }))}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Turn off
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  (await enablePush(hour)) === "denied"
                    ? { kind: "blocked" }
                    : { kind: "ready", status: { subscribed: true, hour } },
                )
              }
              className="rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-60 dark:text-black"
            >
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
