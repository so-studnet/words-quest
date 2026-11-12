"use client";

// This device's Web Push subscription, stored in Supabase (push_subscriptions, owner-only).

import { getBrowserSupabase } from "@/lib/supabase/client";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

/** Push needs the VAPID public key at build time. */
export const isPushConfigured = Boolean(vapidPublicKey);

export const DEFAULT_NOTIFY_HOUR = 8;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  );
}

/** iPhone/iPad Safari: push works only from a Home Screen app. */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  return av.every((x, i) => x === b[i]);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export type PushStatus = { subscribed: false } | { subscribed: true; hour: number };

/** Whether this device is registered, and for which hour. */
export async function getPushStatus(): Promise<PushStatus> {
  const sub = await currentSubscription();
  if (!sub || Notification.permission !== "granted") return { subscribed: false };
  const { data, error } = await getBrowserSupabase()
    .from("push_subscriptions")
    .select("notify_hour")
    .eq("endpoint", sub.endpoint)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { subscribed: true, hour: data.notify_hour as number } : { subscribed: false };
}

/** Ask for permission (if needed), subscribe this device, and save it with `hour`. */
export async function enablePush(hour: number): Promise<"ok" | "denied"> {
  if (!vapidPublicKey) throw new Error("Push is not configured");
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  const key = base64UrlToBytes(vapidPublicKey);
  const registration = await navigator.serviceWorker.ready;
  let sub = await registration.pushManager.getSubscription();
  // If the server key changed, the old subscription can no longer be used.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Incomplete push subscription");
  const { error } = await getBrowserSupabase().from("push_subscriptions").upsert({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
    notify_hour: hour,
  });
  if (error) throw new Error(error.message);
  return "ok";
}

export async function setPushHour(hour: number): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const { error } = await getBrowserSupabase()
    .from("push_subscriptions")
    .update({ notify_hour: hour })
    .eq("endpoint", sub.endpoint);
  if (error) throw new Error(error.message);
}

/** Remove this device (turning notifications off, or signing out). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await getBrowserSupabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
