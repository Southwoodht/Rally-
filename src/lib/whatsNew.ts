/**
 * What's new.
 *
 * Shown to each person once, on their own Home. It is deliberately **not** a
 * post to the league: a post goes to everybody at once, in a feed people
 * read for results, and nobody asked their club for release notes. This is a
 * card you dismiss and never see again.
 *
 * Add to the top when something ships that a player would notice. Things
 * only the code would notice do not belong here — a changelog nobody can
 * feel is just noise with a date on it.
 *
 * Bump RELEASE when you add an entry. That string is what gets remembered
 * as "seen", so an old entry never reappears and a new one always shows.
 */

export const RELEASE = "2026-10-22";

export interface NewsItem {
  /** A few words. The headline is what most people will read and nothing else. */
  title: string;
  /** One sentence, in plain English, about what changed for them. */
  detail: string;
}

// The 2026-09-11 entries (asks how it went, nudges, photos, avatars, invite
// links, six levels) were cut on 2026-10-22: everybody who was here then has
// seen them, and a newcomer reading eight items reads none.
export const WHATS_NEW: NewsItem[] = [
  {
    title: "A quick tour",
    detail: "Five steps, one for each button along the bottom. You can take it again any time from Help.",
  },
  {
    title: "One table",
    detail: "The club table now has one ranking. Your rating has a ± for how sure it is, and players who haven't played much sit underneath until they have.",
  },
  {
    title: "Points for every match",
    detail: "Your match history shows how many points each result gained or lost you, with a Why? that explains it.",
  },
  {
    title: "Emails",
    detail: "You'll get an email when somebody challenges you or books a time, and a reminder before a competition deadline. You can switch them off in My profile.",
  },
];
