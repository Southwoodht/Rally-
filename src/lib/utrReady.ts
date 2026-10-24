import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Whether the database has a column yet — players.utr
 * (schema_player_utr.sql), fixtures.venue (schema_fixture_venue.sql).
 *
 * Some saves go through the ordinary sync, and a save naming a column the
 * database lacks fails the WHOLE save — at sign-up that would lose the
 * level, on a booking the booking. So the field is only offered once this
 * says the column is there. No database at all (the dev preview) says yes.
 */
const known: Record<string, boolean> = {};

export function useColumnReady(table: string, column: string): boolean {
  const key = table + "." + column;
  const [ready, setReady] = useState<boolean>(known[key] ?? !supabase);
  useEffect(() => {
    if (!supabase || key in known) return;
    let live = true;
    Promise.resolve(supabase.from(table).select(column).limit(1)).then(
      (res: any) => { known[key] = !res?.error; if (live) setReady(known[key]); },
      () => {},
    );
    return () => { live = false; };
  }, [key, table, column]);
  return ready;
}

export function useUtrReady(): boolean {
  return useColumnReady("players", "utr");
}
