"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase, isAuthConfigured } from "@/lib/supabase/client";

export type AuthState =
  | { status: "disabled" } // Supabase not configured: no sign-in at all
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; email: string | null };

const DISABLED: AuthState = { status: "disabled" };
const LOADING: AuthState = { status: "loading" };
const SIGNED_OUT: AuthState = { status: "signed-out" };

let state: AuthState = isAuthConfigured ? LOADING : DISABLED;
let started = false;
const listeners = new Set<() => void>();

function apply(session: Session | null) {
  const userId = session?.user.id ?? null;
  if (userId && state.status === "signed-in" && state.userId === userId) return;
  state = userId ? { status: "signed-in", userId, email: session?.user.email ?? null } : SIGNED_OUT;
  listeners.forEach((l) => l());
}

function start() {
  if (started || !isAuthConfigured || typeof window === "undefined") return;
  started = true;
  // INITIAL_SESSION and every later change arrive here.
  getBrowserSupabase().auth.onAuthStateChange((_event, session) => apply(session));
}

export function subscribeAuth(onChange: () => void): () => void {
  start();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export const getAuthState = () => state;
const getServerAuthState = (): AuthState => (isAuthConfigured ? LOADING : DISABLED);

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getServerAuthState);
}

/** null on success, otherwise a message to show. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await getBrowserSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (error.code === "invalid_credentials" || error.status === 400) return "Wrong email or password.";
  if (error.code === "email_not_confirmed") return "This email address is not confirmed yet.";
  if (error.status === 429) return "Too many attempts. Please wait a moment and try again.";
  return "Could not sign in. Check your connection and try again.";
}

export async function signOut(): Promise<void> {
  // Stop this device's notifications before the session (needed to delete the row) is gone.
  const { disablePush } = await import("@/lib/push-client");
  await disablePush().catch((e) => console.warn("[push] could not remove this device", e));
  await getBrowserSupabase().auth.signOut();
}
