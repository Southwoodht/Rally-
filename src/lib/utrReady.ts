import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Whether the database has players.utr yet (schema_player_utr.sql).
 *
 * A player saving their own UTR goes through the ordinary save, and a save
 * naming a column the database lacks fails the WHOLE save — at sign-up that
 * would lose their level too. So the question is only asked once this says
 * the column is there. No database at all (the dev preview) says yes.
 */
let known: boolean | null = null;

export function useUtrReady(): boolean {
  const [ready, setReady] = useState<boolean>(known ?? !supabase);
  useEffect(() => {
    if (!supabase || known !== null) return;
    let live = true;
    Promise.resolve(supabase.from("players").select("utr").limit(1)).then(
      (res: any) => { known = !res?.error; if (live) setReady(known); },
      () => {},
    );
    return () => { live = false; };
  }, []);
  return ready;
}
