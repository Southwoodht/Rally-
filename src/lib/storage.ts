import { supabase, withSupabaseTimeout } from "@/lib/supabase";

/**
 * Storage adapter.
 *
 * The prototype used browser storage, but this seam now talks to Supabase so
 * league state and other shared data can be synced across devices.
 */

export interface StorageRecord {
  key: string;
  value: string;
  shared: boolean;
}

const PREFIX = "rally:";

// Distinct from "the row doesn't exist" — withSupabaseTimeout can't tell us
// that on its own, since a fallback value and a real empty result look the
// same to callers. A load that failed must never be mistaken for a load
// that succeeded and found nothing, because callers treat "nothing" as
// license to seed fresh data and write it back over whatever's really there.
const READ_FAILED = Symbol("storage-read-failed");
const WRITE_UNCONFIRMED = Symbol("storage-write-unconfirmed");

function available(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

async function readLocal(key: string): Promise<StorageRecord | null> {
  if (!available()) return null;
  const value = window.localStorage.getItem(PREFIX + key);
  if (value === null) return null;
  return { key, value, shared: false };
}

async function writeLocal(key: string, value: string): Promise<StorageRecord | null> {
  if (!available()) return null;
  window.localStorage.setItem(PREFIX + key, value);
  return { key, value, shared: false };
}

export const storage = {
  async get(key: string, shared = false): Promise<StorageRecord | null> {
    if (!supabase) return readLocal(key);

    if (shared) {
      const result = await withSupabaseTimeout(
        supabase.from("shared_storage").select("key, value").eq("key", key).maybeSingle(),
        READ_FAILED as any,
      );
      if (result === (READ_FAILED as any)) throw new Error(`Timed out loading "${key}" from Supabase.`);
      const { data, error } = result;
      if (error) throw error;
      if (!data) return null;
      return { key: data.key, value: data.value, shared: true };
    }

    const { data: userData } = await withSupabaseTimeout(
      supabase.auth.getUser(),
      { data: { user: null }, error: null } as any,
    );
    const uid = userData.user?.id;
    if (!uid) return readLocal(key);

    const result = await withSupabaseTimeout(
      supabase.from("user_storage").select("key, value").eq("user_id", uid).eq("key", key).maybeSingle(),
      READ_FAILED as any,
    );
    if (result === (READ_FAILED as any)) throw new Error(`Timed out loading "${key}" from Supabase.`);
    const { data, error } = result;
    if (error) throw error;
    if (!data) return null;
    return { key: data.key, value: data.value, shared: false };
  },

  async set(key: string, value: string, shared = false): Promise<StorageRecord | null> {
    if (!supabase) return writeLocal(key, value);

    if (shared) {
      const result = await withSupabaseTimeout(
        supabase.from("shared_storage").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }),
        WRITE_UNCONFIRMED as any,
      );
      // A timeout here means we genuinely don't know whether the upsert
      // landed — never report that as success. Fall back to local same as
      // a confirmed error, rather than telling the caller the shared write
      // happened when it might still be in flight or may never land.
      const error = result === (WRITE_UNCONFIRMED as any) ? new Error(`Timed out saving "${key}" to Supabase.`) : result.error;
      if (!error) return { key, value, shared: true };
      return writeLocal(key, value);
    }

    const { data: userData } = await withSupabaseTimeout(
      supabase.auth.getUser(),
      { data: { user: null }, error: null } as any,
    );
    const uid = userData.user?.id;
    if (!uid) return writeLocal(key, value);

    const result = await withSupabaseTimeout(
      supabase.from("user_storage").upsert({ user_id: uid, key, value, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" }),
      WRITE_UNCONFIRMED as any,
    );
    const error = result === (WRITE_UNCONFIRMED as any) ? new Error(`Timed out saving "${key}" to Supabase.`) : result.error;
    if (!error) return { key, value, shared: false };
    return writeLocal(key, value);
  },

  async remove(key: string): Promise<void> {
    if (!supabase) {
      if (!available()) return;
      window.localStorage.removeItem(PREFIX + key);
      return;
    }

    if (!supabase) return;
    const { data: userData } = await withSupabaseTimeout(
      supabase.auth.getUser(),
      { data: { user: null }, error: null } as any,
    );
    const uid = userData.user?.id;
    if (!uid) return;

    await withSupabaseTimeout(supabase.from("user_storage").delete().eq("user_id", uid).eq("key", key), null as any);
  },
};

export default storage;
