"use client";
import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DEFAULT_THEME, THEMES, applyTheme, readStoredTheme, storeTheme, themeName,
  type ThemeId,
} from "@/lib/themes";
import {
  FEED_CARD, FEED_LIME, FEED_OVERLAY, FEED_PAGE, FEED_RADIUS, FEED_TEXT_HI,
  FEED_TEXT_MID, LINE, body,
} from "@/lib/theme";

// Pick a theme.
//
// Applying one is a single attribute on <html> — every colour in the app is a
// variable and lib/theme.ts hands components `var(--…)` strings, so nothing
// re-renders and nothing re-reads a palette. That is the whole reason the
// previous task put the tokens in CSS rather than in JavaScript.
//
// The swatches are the one place hex is allowed outside themes.css, and the
// reason is structural rather than lazy: a row previews a theme that is NOT
// applied, so var(--hero) inside the menu resolves to the CURRENT theme on
// every row and renders five identical swatches. They live in lib/themes.ts
// beside the names, so at least the two lists sit together.

const NARROW = 360;
const MENU_W = 260;
const EDGE = 8;

function Swatch({ colours, size = 14 }: { colours: [string, string, string]; size?: number }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {colours.map((c, i) => (
        <span
          key={i}
          style={{
            width: size, height: size, borderRadius: size / 2, background: c,
            // Overlapping by 4px, and each disc outlined so the overlap reads
            // as a stack rather than as a blur.
            //
            // The outline is LINE and not FEED_CARD. Ringing in the card
            // colour separates the discs from each other but gives the outer
            // edge nothing, so on sw19 and melbourne — whose cards are pure
            // white — paris's #F3ECE2 and melbourne's own #EAF3FB were white
            // discs, white-ringed, on white, and a three-colour preview showed
            // two colours. LINE does both jobs in all five themes.
            marginLeft: i ? -4 : 0,
            boxShadow: "0 0 0 1.5px " + LINE,
            zIndex: 3 - i,
          }}
        />
      ))}
    </span>
  );
}

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [active, setActive] = useState(0);
  const [left, setLeft] = useState(0);
  const wrap = useRef<HTMLDivElement | null>(null);

  // The boot script in <head> has already set the attribute before paint, so
  // this reads what is on the document rather than deciding it — two sources
  // of truth would flash exactly once, on the first render, which is the
  // thing the boot script exists to prevent.
  useEffect(() => {
    const onDoc = document.documentElement.dataset.theme as ThemeId | undefined;
    const now = onDoc || readStoredTheme() || DEFAULT_THEME;
    setTheme(now);
    // Re-apply rather than only read. The attribute is already right — the
    // boot script saw to that — but the boot script had to guess the status
    // bar colour from a table, having run before the stylesheet. This is the
    // first moment computed style is readable, so it is where themes.css
    // takes the colour back.
    applyTheme(now);
  }, []);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < NARROW);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Where the popover can actually sit.
  //
  // It used to be `right: 0`, which right-aligns it to the TRIGGER — and the
  // trigger is in the middle of the header, not at the edge of the screen, so
  // a 260px menu hung 28px off the left of a 390px phone with the swatches
  // clipped. Right-aligning is still the preference; this only clamps it into
  // the viewport when that would overflow, which is what a header this narrow
  // needs. Offsets stay relative to the wrapper so the menu can remain
  // absolutely positioned — `fixed` would break inside the transformed
  // ancestors Home animates its cards with.
  useEffect(() => {
    if (!open || narrow || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const max = window.innerWidth - MENU_W - EDGE;
    const want = Math.min(Math.max(r.right - MENU_W, EDGE), Math.max(max, EDGE));
    setLeft(want - r.left);
  }, [open, narrow]);

  useEffect(() => {
    if (!open) return;
    const onAway = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % THEMES.length); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + THEMES.length) % THEMES.length); }
      if (e.key === "Enter") { e.preventDefault(); choose(THEMES[active].id); }
    };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onAway); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const choose = (id: ThemeId) => {
    applyTheme(id);
    storeTheme(id);
    setTheme(id);
    setOpen(false);
    // Best effort, and deliberately not awaited: the theme is already on
    // screen, and a signed-out visitor has no row to write to.
    import("@/lib/profiles").then((m) => m.saveMyTheme?.(id)).catch(() => {});
  };

  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  const rows = (
    <div role="listbox" aria-label="Theme" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {THEMES.map((t, i) => {
        const on = t.id === theme;
        return (
          <button
            key={t.id}
            role="option"
            aria-selected={on}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              height: 52, borderRadius: 12, padding: 10, border: "none", cursor: "pointer",
              // FEED_PAGE and not FEED_RAISED. On sw19 and melbourne
              // --bg-raised and --bg-card are both pure white, so the
              // highlight was invisible in two of the five themes and
              // keyboard navigation had nothing to show for itself. The page
              // colour is a step away from the card in all five — darker on
              // the dark themes, a tint on the light ones.
              background: i === active ? FEED_PAGE : "transparent",
              textAlign: "left", boxSizing: "border-box",
            }}
          >
            <Swatch colours={t.swatch} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: body, fontWeight: 600, fontSize: 15, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
              <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.caption}</span>
            </span>
            {on && <Check size={18} color={FEED_LIME} strokeWidth={2.4} style={{ flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={wrap} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => { setOpen(!open); setActive(THEMES.findIndex((t) => t.id === theme)); }}
        aria-label={"Theme: " + themeName(theme)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px",
          borderRadius: 18, background: FEED_CARD, border: "none", cursor: "pointer",
        }}
      >
        {/* One disc of the CURRENT theme, so it can use the variables. */}
        <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, background: "var(--hero)", boxShadow: "0 0 0 2px var(--accent)", flexShrink: 0 }} />
        <span style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: FEED_TEXT_HI, whiteSpace: "nowrap" }}>{current.name}</span>
        <ChevronDown size={14} color={FEED_TEXT_MID} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      </button>

      {open && (narrow ? (
        // Under 360px a 260px popover is most of the screen and hangs off the
        // edge of a right-aligned trigger. A sheet is the same list without
        // the arithmetic.
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: FEED_OVERLAY, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 120 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 620, background: FEED_CARD, borderTopLeftRadius: FEED_RADIUS, borderTopRightRadius: FEED_RADIUS, border: "1px solid " + LINE, padding: "10px 8px calc(20px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}
          >
            {rows}
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute", top: 44, left, width: MENU_W, zIndex: 120,
            background: FEED_CARD, borderRadius: 20, border: "1px solid " + LINE,
            padding: 8, boxSizing: "border-box", boxShadow: "0 8px 24px var(--shadow-strong)",
          }}
        >
          {rows}
        </div>
      ))}
    </div>
  );
}
