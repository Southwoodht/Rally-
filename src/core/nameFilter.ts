/**
 * Offensive words in display names (Sam, 2026-10-24).
 *
 * Checked wherever a name is typed: signing up, onboarding, My profile and an
 * organiser editing a player. It is a filter on whole WORDS, not on letters
 * inside them, because a name filter that matches substrings refuses real
 * people — Scunthorpe, Dickens, Cockburn, Hancock, Shittu, Assante. So "Dick"
 * on its own is refused and "Dickinson" is not.
 *
 * A few stems are matched at the start of a word because they have no
 * innocent continuation in a name ("fuckface", "shithead", "wankstain").
 *
 * It reads through the usual dodges: capitals, leetspeak (f0ck, 5h1t, @ss),
 * stretched letters (fuuuck) and spaced-out letters (f u c k). It will not
 * catch everything, and it is not meant to — an organiser can rename anybody
 * from Run your club → Players, which is the real backstop.
 *
 * Pure: no React, no Supabase. Tested in nameFilter.test.ts.
 */

/** Refused as a whole word. */
const WORDS = [
  "fuck", "fucker", "fucking", "fuk", "fck", "cunt", "shit", "shite", "shitter", "piss", "pissed",
  "arse", "arsehole", "ass", "asshole", "bitch", "bastard", "bollocks", "bollock", "bellend",
  "dick", "dickhead", "cock", "cocks", "prick", "knob", "knobhead", "twat", "wank", "wanker", "tosser",
  "slut", "whore", "slag", "tits", "titty", "boobs", "pussy", "penis", "vagina", "dildo", "porn", "cum",
  "nigger", "nigga", "niggers", "faggot", "fag", "fags", "kike", "chink", "coon", "paki", "spic",
  "wog", "gook", "retard", "retarded", "spastic", "spaz", "tranny", "dyke",
  "rape", "rapist", "nonce", "paedo", "pedo", "pedophile", "paedophile", "nazi", "hitler",
];

/** Refused at the start of a word. Only stems no real name begins with. */
const STEMS = ["fuck", "fuk", "cunt", "shithead", "shitface", "wank", "nigg", "fagg", "motherf", "bitch", "twat", "bollock"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t" };

/** The words a name reads as, after undoing the usual disguises. */
function readAs(text: string): string[] {
  const plain = (text || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[0-9@$!|+]/g, (c) => LEET[c] ?? " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
  if (!plain) return [];
  const tokens = plain.split(" ");
  // "f u c k": runs of single letters read as one word, beside the letters.
  const joined: string[] = [];
  let run = "";
  for (const t of tokens) {
    if (t.length === 1) { run += t; continue; }
    if (run.length > 1) joined.push(run);
    run = "";
  }
  if (run.length > 1) joined.push(run);
  return [...tokens, ...joined];
}

/** Stretched letters squeezed: "fuuuck" → "fuck", "shiiit" → "shit". */
const squeeze = (w: string) => w.replace(/(.)\1+/g, "$1");

const WORD_SET = new Set([...WORDS, ...WORDS.map(squeeze)]);

/** True when the name contains a word we refuse. */
export function isOffensiveName(text: string): boolean {
  for (const w of readAs(text)) {
    if (WORD_SET.has(w) || WORD_SET.has(squeeze(w))) return true;
    const s = squeeze(w);
    if (STEMS.some((st) => w.startsWith(st) || s.startsWith(squeeze(st)))) return true;
  }
  return false;
}

/** The sentence every name field shows when it refuses one. */
export const OFFENSIVE_NAME_MESSAGE = "That name isn't allowed. Please use your real name.";
