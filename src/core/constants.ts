

export const START_ELO = 0, K = 40;

export const LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro"];

export const SUBS = ["Low", "Medium", "High"];

// A fair, same-level win is worth K*0.5 = 20 points. LV_FACTOR/MIN/MAX shape
// how hard a level gap (see core/levels.ts's 12-point scale) discounts an
// expected result and rewards an upset — wide on purpose, since a full
// category (Beginner/Intermediate/Advanced/Pro) is meant to be a real gap,
// not a coin-flip. See core/elo.ts for exactly how these combine.
export const LV_FACTOR = 0.45, LV_MIN = 0.05, LV_MAX = 4.0;
