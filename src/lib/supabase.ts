import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client.
 *
 * Reads the two values from .env.local. If they are missing we deliberately do
 * NOT throw — the app shows a setup screen instead, so a missing key can never
 * present itself as a blank page.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const SUPABASE_REQUEST_TIMEOUT_MS = 4000;

export async function withSupabaseTimeout<T>(request: PromiseLike<T> | any, fallback: T): Promise<T> {
  if (!request) return fallback;

  if (typeof request?.then !== "function") {
    return request as T;
  }

  return await new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), SUPABASE_REQUEST_TIMEOUT_MS);
    request
      .then((value: T) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}
