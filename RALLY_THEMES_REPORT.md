# Rally — the theme picker and the four new themes

Branch `theme/picker`, five commits. Master untouched; nothing has deployed.

**`supabase/schema_profile_theme.sql` was run on 2026-09-24.** The column is
there — `theme text not null default 'rally'` — and the two profiles policies
are untouched. So the picker saves to your account, not just to the browser.

---

## What is there

Five themes — **Rally** (default), **Paris** (clay), **SW19** (grass),
**Flushing** (New York hard court), **Melbourne** (Melbourne hard court) — and
a pill in the header that switches between them.

Switching is one attribute on `<html>`. Every colour in the app is already a
CSS variable and `lib/theme.ts` hands components `var(--…)` strings, so nothing
re-renders and no component knows a theme exists. That was the point of the
previous task putting the tokens in CSS rather than in JavaScript, and it paid
here: **the four new themes are four blocks in one file.**

Each theme also gets its own display face — Fraunces on paris, Cormorant on
sw19, Space Grotesk on flushing, Sora on melbourne — because `--font-display`
is an indirection a block can repoint. The four extra fonts are loaded with
`preload: false`, so only Bricolage costs anything on first paint.

---

## The seventeen tokens the brief didn't specify

The brief supplied 25 of the 42 tokens and said to stop and ask rather than
guess. That is the stop I raised; the answer was to use my judgement, so every
one of them is **derived from that theme's own palette** rather than invented:

| token | derived as |
|---|---|
| `--text-dim` | its `--text-mid`, moved toward its page |
| `--on-hero-mid`, `--on-hero-line` | its `--on-hero`, moved toward its `--hero` |
| `--bar-fill` | a tint of its page, so a bar behind a row reads as a length |
| `--up` / `--down` | darkened on the light themes, where rally's pass on green and fail on white |
| `--danger-dim` | its `--danger`, moved toward its card |
| `--ramp-1..6` | six steps from its `--muted-fill` to its `--accent` |

Four are deliberately **not** redefined per theme and inherit from `:root`:
`--shadow`, `--shadow-strong`, `--track` and `--font-body`. Black alphas and DM
Sans are correct on light and dark alike, and duplicating them is four more
places to drift.

---

## Things that had to change shape, not just colour

- **Cards now carry a 1px `--line` border.** On rally it is nearly invisible,
  which is why they never had one. On sw19 and melbourne the card is pure white
  on a near-white page, and without an edge the whole screen reads as one
  undifferentiated sheet. Done in `SurfaceCard` and in `theme.ts`'s `card` and
  `listCard`, so one edit reached every screen.
- **A `--status-bg` strip.** The installed app runs black-translucent, so iOS
  draws the clock and battery in white and never changes them. On the three
  light themes that is white on white. The safe-area strip is painted in each
  theme's status colour so those icons always have something underneath.

---

## What checking it on screen actually found

Five bugs, none of which were visible in the code. All fixed.

1. **The menu hung off the left edge of the phone.** The popover was
   `right: 0`, which right-aligns it to the *trigger* — and the trigger sits in
   the middle of the header, not at the edge of the screen. At 390px a 260px
   menu started at −28 and the swatches were clipped. It now prefers
   right-alignment and clamps into the viewport.
2. **The keyboard highlight was invisible in two themes.** Rows highlighted on
   `--bg-raised`, which on sw19 and melbourne is the same pure white as
   `--bg-card`. Now `--bg-page`, which is a step away from the card in all five.
3. **Two swatches were white discs, white-ringed, on white.** Each disc was
   outlined in the card colour to separate it from its neighbour, which gave the
   outer edge nothing — so paris's cream and melbourne's pale blue vanished on
   the white-card themes and a three-colour preview showed two. Ringed in
   `--line` now, which does both jobs everywhere.
4. **Rally had no `--status-bg` at all** — the only theme missing it. Two
   consequences: the safe-area strip painted nothing, and `applyTheme()` skips
   the meta update when the value is empty, so **switching back to rally left
   the phone's status bar on the previous theme's colour.**
5. **The browser chrome was the wrong colour on every plain load.** The boot
   script set the attribute but not the meta, and `layout.tsx` declares a static
   `themeColor`, so a melbourne user opened the app to a blue screen under a
   dark green status bar — not a flash but a permanent mismatch, since nothing
   called `applyTheme()` on an ordinary load. The boot script now sets both.

That last one is why `ThemeOption` gained a `status` field. The boot script runs
before the stylesheet and cannot read computed style, so a theme's chrome colour
has to exist in JavaScript for exactly that one moment. `themes.css` stays
authoritative: `applyTheme()` reads the computed value and `ThemePicker` calls
it on mount, so any drift between the two is corrected the instant React
hydrates.

Also fixed: **a hydration warning on every load.** The server always sends
`rally` and the boot script always rewrites it, so React logged an attribute
mismatch on any other theme. `suppressHydrationWarning` on `<html>` — required,
not tidying, and it suppresses that one element's attributes and nothing inside.

---

## Contrast, measured

Computed from the live computed styles, not judged. Every pairing the brief
named is **at or above 4.5:1 in all five themes**:

| | rally | paris | sw19 | flushing | melbourne |
|---|---|---|---|---|---|
| `--text-mid` on `--bg-card` | 5.93 | 6.60 | 5.67 | 6.76 | 6.06 |
| `--on-hero` on `--hero` | 13.62 | **4.50** | 7.30 | 13.02 | 6.33 |
| `--on-cta` on `--cta` | 9.35 | 14.81 | 10.16 | 8.06 | 10.28 |
| `--on-accent` on `--accent` | 9.35 | 5.40 | 7.30 | 8.06 | 6.33 |
| `--text-hi` on `--bg-page` | 13.62 | 13.88 | 13.56 | 16.67 | 14.07 |
| `--text-mid` on `--bg-page` | 7.52 | 6.01 | 5.15 | 7.79 | 5.40 |

**The one to know about is paris's `--on-hero` on `--hero`: exactly 4.50.** The
clay `#B9502B` is the lightest of the three brand colours and it passes AA for
body text with nothing whatsoever to spare — any future nudge lighter fails.
Left as specified rather than adjusted, as the brief asked.

---

## Verified on screen

At 390px: Home in all five themes; Table, Fixtures and Profile in flushing;
Profile, Add result and the Profile menu sheet in sw19; the picker menu in
melbourne and sw19. At 340px the picker becomes a bottom sheet, which was
checked too.

Reload on melbourne comes up melbourne with **no flash of green** — the boot
script sets the attribute before first paint, and `body` was already the right
colour when the first script ran.

A full round trip (melbourne → rally through the real menu) leaves the
attribute, localStorage, the meta colour, the strip and the pill's label all
in agreement.

**Grep sweep.** No `rgb()`/`rgba()` anywhere outside `themes.css`. Remaining hex
is exactly: the five swatch triples and the five `status` values in
`lib/themes.ts` (both documented exceptions — a row previews a theme that is not
applied, and the boot script runs before the stylesheet), `layout.tsx`'s static
`themeColor`, `Robin.tsx` (§6 says don't recolour) and `core/difficulty.ts` (§5
says data colours stay).

**Gate.** `tsc` clean, `check:sql` clean, `check:hooks` clean, `test:core`
352/352 across eight files, `npm run build` **exit 0**.

---

## What is NOT done

- **The second-device test is now possible but has not been done.** The column
  landed on 2026-09-24, so the write should succeed; nobody has yet picked a
  theme on one device and opened the app on another to watch it follow. That is
  the one remaining check from the brief's Phase 5.
- **Not looked at in every theme.** Messages, Compare, Match detail and the
  Global table are on-palette and go through the shared primitives, but were
  checked in one or two themes rather than five.
- **`core/difficulty.ts`'s tier colours were tuned against the old greens.**
  They are data colours and §5 says leave them, but they sit oddly on the light
  themes — visible on the Table's opponent bars in sw19 and melbourne. Flagged,
  not changed.
- **Only `body` transitions on a theme change**, 200ms. Cards and text swap
  instantly. Transitioning everything makes a five-colour change look like a
  dissolve and costs a frame on every unrelated hover.
