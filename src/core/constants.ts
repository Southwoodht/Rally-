

export const START_ELO = 0, K = 40;

// Six categories, three subs each: the 18-point scale (see core/levels.ts).
// Amateur and Semi-pro were inserted between the original four, which are
// kept under their exact original names — level is stored as {cat, sub}
// strings and levelVal() looks the category up by name, so renaming any of
// them would leave every existing player's level unresolvable and silently
// unrated. Adding to this list is safe; reordering or renaming is not.
//
// Inserting adds a flat +3 to the distance between any pair that straddles
// a new category and nothing to any pair that doesn't. So Beginner and
// Intermediate are now 6 apart rather than 3, while Intermediate and
// Advanced are still 3. That is deliberate — under six tiers those two
// really are two tiers apart — but it means a one-off shift in ELO for the
// people either side of it. Measured against the production snapshot: the
// Official table doesn't move at all, ELO moves for two players, and both
// return to their exact previous rating if the person between them takes
// up one of the new tiers.
export const LEVELS = ["Beginner", "Amateur", "Intermediate", "Advanced", "Semi-pro", "Pro"];

export const SUBS = ["Low", "Medium", "High"];

// A fair, same-level win is worth K*0.5 = 20 points. LV_FACTOR/MIN/MAX shape
// how hard a level gap (see core/levels.ts's 18-point scale) discounts an
// expected result and rewards an upset — wide on purpose, since a full
// category is meant to be a real gap, not a coin-flip. See core/elo.ts for
// exactly how these combine.
//
// Unchanged across the move to 18 points, and that is the correct answer
// rather than an oversight: a category is 3 points wide on both scales, so
// at 0.45 a one-category-up win is worth exactly what it always was.
// Refitting the factor to the new scale was tried and is worse — it leaves
// the pairs that genuinely moved slightly closer to their old value at the
// cost of changing every pair the new scale never touched.
export const LV_FACTOR = 0.45, LV_MIN = 0.05, LV_MAX = 4.0;

// Official points: how an opponent's strength is judged, and what a loss to
// them costs. Sam ruled on 2026-09-27; the reasoning is on computeOfficial.
//
// OFFICIAL_LEVEL_TRUST is how many matches' worth of evidence a recorded level
// counts for. An opponent's strength is their level and their results blended
// by weight: with 3 matches the level is two-thirds of it, with 6 it is half,
// with 25 (Zaach, 2026) under a fifth. Six is the number the Global table
// already uses for "six matches halve the trust in a claim".
//
// A loss costs (2 - q) where q is the opponent's strength against the club
// average, clamped to 0.40..1.60 — symmetric about 1, so a gap means the same
// thing whichever way round it runs (see §9 on LV_MIN/LV_MAX in elo.ts for
// what an asymmetric pair does). These replaced WIN_QUALITY_DIVISOR and
// LOSS_GAP_FORGIVE, which judged opponents by level alone.
export const OFFICIAL_LEVEL_TRUST = 6;
export const OFFICIAL_LOSS_MIN = 0.40, OFFICIAL_LOSS_MAX = 1.60;

// How much of a scored result is the margin rather than the bare win or
// loss: worth `(1 - W) * result + W * share`. Lived in globalTable.ts until
// two different ratings needed it, and a weight copied into two files is a
// weight that will disagree with itself. Still in the app and never in the
// SQL — the database reports what happened, the app decides what it's worth,
// so tuning this needs no migration.
//
// A share of games rather than a difference, because Rally covers several
// racket sports: 6-0 tennis, 11-0 squash and 21-0 badminton all have to mean
// the same thing, and a margin in games would rate the badminton player
// highest for doing the same thing.
export const MARGIN_WEIGHT = 0.35;
