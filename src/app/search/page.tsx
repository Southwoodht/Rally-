import { PlayerSearch } from "@/components/social/PlayerSearch";

/**
 * /search — find anybody on Rally.
 *
 * A route rather than a tab, so the back chevron goes back to wherever you
 * opened it from. It searches accounts, not league rows, which is the point:
 * the whole complaint was being unable to reach somebody you share no league
 * with.
 */
export default function SearchPage() {
  return <PlayerSearch />;
}
