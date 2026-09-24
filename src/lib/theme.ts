
import type { CSSProperties } from "react";

// EVERY COLOUR IN THIS FILE IS A CSS VARIABLE. Not one hex code, here or in
// any component — the values live in src/styles/themes.css, one block per
// theme, which is what makes adding paris/sw19/flushing/melbourne later a
// CSS change and nothing more.
//
// The brief asked for these to be wired into Tailwind. That would have done
// nothing: Tailwind is installed and unused here — six className attributes
// in the whole app and no palette classes. Rally is ~1,630 inline style
// objects reading these constants, so pointing the constants at variables
// re-themes all of them without touching a component.
//
// The old names are kept and re-pointed rather than renamed. 87 files import
// them; renaming would have been a 400-line diff in which a real mistake
// could hide, and the names are still accurate about their ROLE.
export const COURT = "var(--bg-page)",
  PANEL = "var(--bg-card)",
  PANEL2 = "var(--bg-raised)",
  CHALK = "var(--text-hi)";

// BALL was the lime, and the lime split in two. It is the small-accent gold
// here — text, icons, marks, primary buttons — because that is what most of
// its call sites are. The big filled surfaces it used to cover (the rank
// card, a selected pill, the centre button) take FEED_HERO / FEED_FAB
// instead, one call site at a time.
export const BALL = "var(--accent)",
  CLAY = "var(--danger)",
  MUTED = "var(--text-mid)",
  LINE = "var(--line)";

export const NICKS = ["The Destroyer", "The Wall", "Silky", "The Machine", "Hurricane", "The Surgeon", "Baseline Bandit", "The Postman", "Iceman", "The Analyst", "Topspin", "The Bulldozer", "Smash Hit", "The Professor", "Nightmare", "The Cannon", "Slice King", "The Freight Train", "Deadeye", "The Magician"];

export const AVATARS = ["🎾", "🏆", "🔥", "⚡", "🐐", "🦊", "🐢", "🎯", "💪", "🧱", "👑", "🏓", "🥊", "😎", "🍕", "🤖"];

// AV_COLORS and avCell went with the avatar picker they coloured. Nothing
// rendered them after the avatars became "a photo or initials", and eight
// off-palette hexes surviving in a theme file is exactly the thing this
// change exists to stop.

// ---- style tokens ----

// Condensed display font — reserved for big page-level headings (TABLE,
// PROFILE, COMPARE…) only. Everything else, including player names, reads
// as normal sentence-case body text now.
// Bricolage Grotesque. Page titles, the greeting, every big number, player
// names in headers, card headlines. Loaded by next/font in the root layout;
// the variable indirection is in themes.css so a future theme can repoint the
// family without touching a component.
export const display = "var(--font-display)";

// DM Sans. Everything else.
export const body = "var(--font-body)";

// Numbers only — ratings, scores, dates, counters.
// The numbers font is gone. It was JetBrains Mono, kept for figures after
// the "monospace for numbers" rule, and then the scoreboard system replaced
// that rule with the body font plus tabular figures — which gives the column
// alignment that was the only reason for a mono face, without reading as
// code beside this palette. What was left was uppercase mono labels on the
// screens the scoreboard roll never reached: Welcome, the trophies, the club
// admin, Legacy, the small inputs. Sam's note was "no code looking stuff",
// and a label nobody can tap is what that means in practice.
//
// Removed rather than deprecated, so it cannot come back one call site at a
// time, and the font is no longer fetched at all.

export const SOFT_SHADOW = "var(--shadow)";
export const RADIUS = 16;
export const RADIUS_SM = 12;

export const fxBtn: CSSProperties = { flex: 1, fontFamily: body, fontWeight: 600, fontSize: 13, padding: "10px 6px", borderRadius: RADIUS_SM, cursor: "pointer", border: "none", background: PANEL2, color: CHALK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// The fonts are loaded once by next/font in the root layout. This used to be
// an @import string injected into a <style> tag by six different components,
// which fetched Google Fonts from inside the render tree on six screens.
// Kept as an empty string so the call sites can be removed in their own
// commit rather than all at once.
export const fontImport = "";

export const wrap: CSSProperties = { background: COURT, minHeight: "100vh", width: "100%" };

export const card: CSSProperties = { background: PANEL, borderRadius: 26, padding: 20, boxShadow: SOFT_SHADOW };

// §5: --bg-raised, a 1px --line border, radius 14. The border is new — the
// old inputs were a bare fill, which reads as a panel rather than a field on
// a surface this close in tone, and is the kind of thing that only becomes
// obvious on the light themes in Appendix A.
//
// The focus ring is a class rather than an inline style, because :focus
// cannot be expressed in a style object. See globals.css.
export const input: CSSProperties = { width: "100%", boxSizing: "border-box", background: PANEL2, color: CHALK, border: "1px solid " + LINE, borderRadius: 14, padding: "13px 14px", fontFamily: body, fontSize: 15, marginBottom: 0, outline: "none" };

export const miniInput: CSSProperties = { boxSizing: "border-box", background: PANEL2, color: CHALK, border: "1px solid " + LINE, borderRadius: 14, padding: "8px 10px", fontFamily: body, fontSize: 12, outline: "none" };

export const menuRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", background: PANEL, border: "none", borderRadius: RADIUS_SM, padding: "16px 16px", marginBottom: 10, cursor: "pointer" };

// One soft, shadowed card wrapping a whole list — rows separate by padding,
// not by hairline borders.
export const listCard: CSSProperties = { background: PANEL, borderRadius: 26, boxShadow: SOFT_SHADOW, overflow: "hidden" };

export const listRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer" };

// A soft filled pill — level badges, tags, status chips.
export const pill = (bg: string, fg: string): CSSProperties => ({ fontFamily: body, fontWeight: 600, fontSize: 11, color: fg, background: bg, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap", display: "inline-block" });

// iOS-style segmented control: a recessed track holding equal-width options.
export const segmentTrack: CSSProperties = { display: "flex", gap: 2, background: "var(--track)", borderRadius: 12, padding: 3 };

export const segmentOption = (on: boolean): CSSProperties => ({
  flex: 1, textAlign: "center", padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer",
  fontFamily: body, fontWeight: 600, fontSize: 13,
  background: on ? PANEL2 : "transparent", color: on ? CHALK : MUTED,
  boxShadow: on ? "0 1px 4px var(--shadow-strong)" : "none",
  transition: "background 0.15s ease, color 0.15s ease",
});

// ---- feed / scoreboard tokens ----
//
// These are the app's own colours, named for the job they do on a card.
// Almost every one of them IS a brand token above: FEED_CARD is PANEL,
// FEED_PAGE is COURT, FEED_LIME is BALL. They're aliased rather than copied
// so there is exactly one definition of each colour — the first version of
// this block sampled them by eye and every value was a shade off, which is
// what a second copy of a palette always eventually becomes.
export const FEED_PAGE = COURT;
export const FEED_CARD = PANEL;
export const FEED_RAISED = PANEL2;
export const FEED_LIME = BALL;
export const FEED_TEXT_HI = CHALK;

// The one genuinely new colour: a step below COURT, for tiles inset into a
// card that need to read as recessed rather than raised.
export const FEED_DEEP = "var(--bg-bar)";

// Text on lime, and the same value as FEED_DEEP — a coincidence in the
// palette rather than a relationship, so it's named separately: changing the
// inset tile background should not silently restyle every winner bar.
export const FEED_LIME_INK = "var(--on-accent)";

// Secondary text on lime. 7.47:1, against 4.61:1 for the value this
// replaced — same ink family as FEED_LIME_INK rather than a separate green,
// so the two read as one voice at two volumes.
export const FEED_LIME_INK_2 = "var(--on-hero-mid)";

// A rule drawn on lime. Ink at low opacity rather than a named colour, so it
// stays correct if the lime ever moves.
export const FEED_LIME_DIVIDER = "var(--on-hero-line)";

// The two quiet text tiers, measured against PANEL — the card — because
// that is the surface the brief names and the one they actually land on.
// An earlier version of this solved for PANEL2 instead and came out
// noticeably brighter than anyone would pick by eye; PANEL2 is a hairline
// colour now, not a text surface, so that constraint was self-imposed.
//
// Measured contrast on PANEL:
//   FEED_TEXT_MID  --text-mid  4.98:1   two steps up from MUTED
//   FEED_TEXT_LOW  --text-mid  4.55:1   one step up
//
// MUTED as given is 4.07:1, which fails AA for 12px text — the reason for
// moving at all. MUTED itself is untouched: it is correct everywhere else
// in the app, where it is rarely set this small.
//
// They stay a clear step apart because low has to be quieter than mid and
// still clear 4.5, which only works if mid moves up as well. FEED_TEXT_LOW
// is this file's own tier, not one from the brief — metadata needed a voice
// below the losing side of a scoreline.
export const FEED_TEXT_MID = "var(--text-mid)";
// Folded into --text-mid. It was one measured step from it and the new token
// set has three text tiers, not four; nothing on screen distinguished them.
export const FEED_TEXT_LOW = "var(--text-mid)";

// Row dividers are the raised surface colour, which makes a divider read as
// the edge of the next surface rather than as a line drawn over this one.
// It is very quiet by design — barely separable from the card it sits on,
// far too little for text and about right for a rule you are not supposed
// to notice.
export const FEED_HAIRLINE = FEED_RAISED;

// Rank movement. Not in the palette because nothing in the app moved up or
// down before; picked to sit beside the greens rather than reusing CLAY,
// which means "clay court" elsewhere and would read as a surface, not a fall.
export const FEED_UP = "var(--up)";
export const FEED_DOWN = "var(--down)";

// The rating bar behind a standings row. Lime at low opacity rather than
// FEED_RAISED, which was the first attempt and was invisible against the
// card — I looked at it on a phone and could not see it at all, which for
// the one element whose entire job is to be a visible length is a total
// failure rather than a subtle one. At 16% it reads as a length without
// competing with the numbers sitting on top of it.
export const FEED_BAR = "var(--bar-fill)";

// Outcome colours, for anywhere a win, a draw and a loss have to be told
// apart as quantities rather than as text — split bars, form bars, dots.
// FEED_LOSS is deliberately quiet: a loss is a fact, not an alarm, and CLAY
// would read as an error state.
export const FEED_WIN = BALL;
export const FEED_DRAW = "var(--line)";
export const FEED_LOSS = "var(--muted-fill)";

// The other person leading. Not CLAY, which means "clay court" in this app,
// and not the movement red, which means "you dropped" — this is somebody
// else being ahead, which is neither a fault nor a fall.
export const FEED_THEY_LEAD = "var(--danger)";

// The same idea at bar and border weight, where a text colour would glare.
export const FEED_THEY_LEAD_DIM = "var(--danger-dim)";

// Outcome dots. Deliberately louder than the bar colours: a segment of a
// split bar is read against its neighbours, but a dot in a row of five has
// to say win, draw or loss on its own.
/**
 * The outcome rail down the left of a match row.
 *
 * All three are legible against FEED_CARD, measured: lime 7.87:1, red 4.76:1,
 * grey 4.55:1. The draw was FEED_DRAW and the loss FEED_LOSS, at 2.16:1 and
 * **1.37:1** — a 3px marker at 1.37 is not a quiet signal, it is an absent
 * one, and the row read as "wins are marked and nothing else is".
 *
 * FEED_LOSS still exists and is still the right quiet green for a scoreline.
 * It is just not a colour anything can be drawn 3px wide in.
 */
export const OUTCOME_RAIL = { W: BALL, D: FEED_TEXT_LOW, L: FEED_THEY_LEAD };

export const DOT_WIN = BALL;
export const DOT_DRAW = MUTED;
// The same red as a rank drop, and for the same reason — both mean it went
// the wrong way.
export const DOT_LOSS = FEED_DOWN;

// Quieter than FEED_TEXT_LOW, for things deliberately switched off — a
// locked achievement, a disabled row. Not for anything a reader has to
// take in, which is why it is allowed below the contrast floor the other
// text tokens hold to.
export const FEED_TEXT_DIM = "var(--text-dim)";

// §4 of the brief: cards are radius 26 with 22px vertical / 18px horizontal
// padding. FEED_PAD stays the horizontal figure because that is how every
// call site uses it; the vertical is FEED_PAD_Y.
export const FEED_RADIUS = 26;
export const FEED_TILE_RADIUS = 14;
export const FEED_PAD = 18;
export const FEED_PAD_Y = 22;

// ---- the new surfaces the lime split into --------------------------------
//
// Cream, for big filled surfaces: the rank card, the "one place behind" card,
// a selected pill or tab. Gold (BALL / FEED_LIME) stays for everything small.
export const FEED_HERO = "var(--hero)";
export const FEED_ON_HERO = "var(--on-hero)";

// The primary button. Its own token rather than an alias of the accent,
// because Appendix A gives two themes a CTA that is not their accent.
export const FEED_CTA = "var(--cta)";
export const FEED_ON_CTA = "var(--on-cta)";

// The centre (+) button, likewise its own in three of the four future themes.
export const FEED_FAB = "var(--fab)";
export const FEED_ON_FAB = "var(--on-fab)";

export const FEED_ACCENT_HOVER = "var(--accent-hover)";
export const FEED_MUTED_FILL = "var(--muted-fill)";
export const FEED_LOST = "var(--lost)";
export const FEED_INITIALS = "var(--text-initials)";
export const FEED_OVERLAY = "var(--overlay)";

// Form dots drawn ON the cream card, where the page's win/loss colours have
// nothing to sit against.
export const FEED_WIN_ON_HERO = "var(--win-on-hero)";
export const FEED_LOSS_ON_HERO = "var(--loss-on-hero)";

// The Global table's level ramp, quietest to accent.
export const LEVEL_RAMP = [
  "var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)",
  "var(--ramp-4)", "var(--ramp-5)", "var(--ramp-6)",
];

// Anything with digits lines up column-wise; anything big enough to show
// loose tracking gets pulled in.
export const tabular: CSSProperties = { fontVariantNumeric: "tabular-nums" };
export const tight = (px: number): CSSProperties => (px > 18 ? { letterSpacing: px >= 26 ? "-0.03em" : "-0.02em" } : {});
