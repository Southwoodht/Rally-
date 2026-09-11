import { PublicProfile } from "@/components/profile/PublicProfile";

/**
 * /players/[id] — one person, full screen.
 *
 * A real route rather than another modal, because the brief asks for a page
 * you can go back from, and because a profile is about a *person* and every
 * other profile surface in this app is about a league membership.
 *
 * The id is accepted in either shape. It is an account id (the uuid in
 * `profiles`) when it comes from search or the friends list, and a league
 * `players.id` when it comes from the table, a match card or the feed.
 * Resolving both means every existing tap target works without rewriting
 * each one to look up an auth id first.
 */
export default function PlayerPage({ params }: { params: { id: string } }) {
  return <PublicProfile id={params.id} />;
}
