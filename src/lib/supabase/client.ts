import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values: safe in the browser. RLS decides what each user can read and write.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Sign-in and the study log exist only when these are set; search works either way. */
export const isAuthConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase is not configured");
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
