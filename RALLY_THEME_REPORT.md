# Rally — the "rally" theme

Branch `theme/rally-default`. Master untouched; nothing has deployed.

## The audit finding that changed the plan

**Tailwind is installed and unused.** Six `className` attributes in the whole
app, zero palette colour classes, and `tailwind.config.ts` has an empty
`theme.extend`.

The brief's Phase 1 asked for the tokens to be wired into Tailwind. That would
have themed nothing, because no component reads a Tailwind class. Rally is
styled by **~1,630 inline `style={{}}` objects** reading constants from
`src/lib/theme.ts`, which **87 files** import.

So: the tokens live in `src/styles/themes.css` as CSS variables, and
`lib/theme.ts` exports `var(--…)` strings instead of hex. Every one of those
1,630 inline styles re-themes with no component edits, and adding `paris`
later is still one CSS block. Tailwind's config is left alone rather than
wired to a layer nothing reads.

The old constant **names** were kept and re-pointed rather than renamed —
renaming across 87 files would have been a 400-line diff with room for a real
mistake to hide, and the names still describe their role.

## Tokens beyond the brief's table

Four, each because a screen needs it:

| token | why |
|---|---|
| `--text-dim` | the app has four text tiers, not three. Low folds into `--text-mid` with no loss; dim is deliberately sub-AA and exists only for decoration (CLAUDE.md §10). Deleting it either promotes decoration to readable or silently drops contrast. |
| `--on-hero-mid`, `--on-hero-line` | quieter ink and a rule **on** cream. The mockup does these with `opacity`, which is the exact trick that breaks on the three light themes in Appendix A. |
| `--bar-fill` | the Table's rating bar, which must read as the accent at low strength and cannot be an alpha, same reason. |
| `--ramp-1..6` | the Global table's level ladder. It climbed to lime and is not derivable from one token. |

Plus `--shadow`, `--shadow-strong` and `--track`, which replaced alphas on
black at their call sites.

## Where the lime went, case by case

Cream (`--hero` / `--fab`): the Home rank card, the "One place behind X" card,
the Table's leader card, the Global leader card, the match scoreline card, the
centre (+) button, every selected pill/tab/segmented control, and a sent
message bubble.

Gold (`--accent` / `--cta`): primary buttons, the bell, unread badges, the
active nav tab, the club selector pill, the "won" count, the current streak,
win bars, filled stars, the avatar ring, links.

`BALL` maps to the accent by default because most of its call sites were
small; the big fills were changed one at a time rather than in bulk.

## Things that changed shape, not just colour

- **`FormDots` gained a second ink.** On cream, a loss used to be the win
  colour at 25% opacity. Two named colours now, because an alpha only reads as
  "quieter" against a known background.
- **The avatar ring is a real 3px border.** It was two stacked box-shadows with
  a card-coloured gap, needed because generated avatar colours could include
  the ball yellow and swallow a lime ring. Those colours no longer exist.
- **Fonts moved to `next/font`.** Bricolage Grotesque (with the `opsz` axis
  requested explicitly) and DM Sans, self-hosted. They replaced a Google Fonts
  `@import` string that **six components injected into a `<style>` tag at
  render time**.
- **Deleted:** `AvatarArt`, `AvatarPicker`, `AV_COLORS`, `avCell`, `colorFor` —
  34 off-palette hexes in code nothing had rendered since the avatars became
  "a photo or initials".

## Verification

**Grep sweep.** Zero `rgb()`/`rgba()` outside `themes.css`. Zero Tailwind
palette classes. Remaining hex is exactly: `Robin.tsx` (§6 says don't
recolour), `core/difficulty.ts` (§5 says data colours stay), `layout.tsx`'s
`themeColor` (the browser reads it before any stylesheet), and three HTML
entities (`&#127922;`) that a naive grep reads as colours.

**Red test.** `--accent`, `--hero`, `--cta` and `--fab` set to red: the rank
card, "Book a match", the (+), the bell and the active nav tab all turned red;
nothing that should have stayed put moved. Reverted.

**On screen at 375px.** Home and Profile checked against Appendix B and C.

## The §5 shape pass

Done through the shared primitives wherever possible, so one edit reaches
every screen rather than ninety edits reaching ninety:

- **Inputs** — `--bg-raised`, a 1px `--line` border, radius 14. The border is
  new; a bare fill reads as a panel rather than a field at these tones.
- **Focus** — `--accent` border on focus, typed against `input/textarea/select`
  in `globals.css`. It cannot live in `theme.ts`: a pseudo-class is not
  expressible in a React style object, and the alternative is an `onFocus`
  handler on every field in the app. `:focus-visible` gives keyboard users a
  ring without giving pointer users one.
- **Toggles** — on is an `--accent` track, off is `--muted-fill` (was
  `transparent`, which made "off" read as absent rather than as off).
- **Sheets and modals** — 13 of them, all now `--bg-card` at radius 26. Several
  sat on `COURT`, the *page* colour, which makes a sheet read as the page
  sliding up rather than as a layer above it.
- **Page titles** — 32/800 uppercase display; back buttons 44×44 on
  `--bg-raised`.
- **Toasts** — `--bg-raised` with `--text-hi`. It was a gold pill, which reads
  as a primary action rather than as the app telling you something.
- **Standings rows** — names 17/600, numbers in the display face at 700, and
  the viewer's own row on `--bg-raised` with position and points in
  `--accent`. The old treatment was a 1.5px ring, which shifts the row's
  contents by a pixel and a half and reads as a wobble when you scroll past
  your own name.

Verified on screen: Home, Profile and Table at 375px.

## What is NOT done

- **No side-by-side screenshots** of Fixtures, match entry or a modal. Home,
  Profile and Table were checked; the rest are on-palette and follow the
  shared primitives, but have not been looked at one by one.
- **Contrast not measured.** `--text-mid` on `--bg-card` and the two ink
  pairings are eyeballed, not computed.
- **W/L/D result badges** (§5) are not implemented as a distinct component —
  the app shows outcomes as coloured dots and rails rather than lettered
  badges, so there was nothing to restyle. If badges are wanted, that is new
  work rather than a restyle.

## Risks

- **Fonts per theme are not purely a CSS change.** `themes.css` maps role to
  face (`--font-display: var(--font-bricolage)`), so a block *can* repoint the
  family — but the new face still needs a `next/font` import in the root
  layout. Appendix A gives each theme its own display font, so that import is
  one extra step per theme.
- **`difficulty.ts`'s seven tier colours were tuned against the old greens.**
  They are data colours and §5 says leave them, but two of them will sit oddly
  on cream. Flagged, not changed.
- **No service worker exists**, so Phase 4's cache bump has nothing to bump and
  nobody needs to close and reopen the app — a reload is enough.
- **The greeting truncates** ("Afternoon, S…") where the mockup's "Morning,
  Samuel" fits. The mockup has no truncation rule; matching it exactly would
  let a long greeting collide with the header buttons.
- **The club name appears twice on Profile** — the Dashboard bar and the pill.
  Pre-existing structure; collapsing it is a layout decision, not a restyle.
