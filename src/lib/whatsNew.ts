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

export const RELEASE = "2026-09-11";

export interface NewsItem {
  /** A few words. The headline is what most people will read and nothing else. */
  title: string;
  /** One sentence, in plain English, about what changed for them. */
  detail: string;
}

export const WHATS_NEW: NewsItem[] = [
  {
    title: "Rally asks how it went",
    detail: "Once a booked match should have finished, Home asks for the result — with the buttons right there, so it is one tap rather than a trip to Fixtures.",
  },
  {
    title: "Chase a result",
    detail: "If you logged a match and the other player hasn't agreed to it yet, you can nudge them. Once a day, so it stays a reminder.",
  },
  {
    title: "Send photos",
    detail: "Messages take pictures now. Tap one to see it full size.",
  },
  {
    title: "New avatars",
    detail: "The avatars are drawn by Rally instead of borrowed from your phone, so everyone sees the same thing whatever they are using.",
  },
  {
    title: "Invite by link",
    detail: "Share a link instead of reading a six-character code down the phone. It works for people who haven't signed up yet.",
  },
  {
    title: "Six levels",
    detail: "Amateur and Semi-pro were added between Beginner and Pro. Worth re-picking yours — nobody gets moved automatically.",
  },
];
