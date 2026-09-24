/**
 * The five themes, and everything that has to agree about them.
 *
 * One list, because five things need to stay in step: the picker's options,
 * the inline script that sets the theme before paint, the localStorage
 * validator, the Supabase check constraint, and themes.css itself. Four of
 * those are code and can read this; the fifth is SQL and cannot, so
 * supabase/schema_profile_theme.sql names the same five values and says out
 * loud that it must be changed with this file.
 *
 * SWATCH COLOURS ARE HARD-CODED HERE, and they are the one deliberate
 * exception to "no hex outside themes.css". A row in the picker previews a
 * theme that is NOT currently applied, so it cannot read that theme's
 * variables — var(--hero) inside the menu resolves to the CURRENT theme's
 * hero on every row, which would render five identical swatches. The brief
 * calls this out and it is the reason.
 *
 * They are copies, so they can drift from themes.css. Keeping them beside the
 * names rather than in the component at least puts the two lists together.
 */

export type ThemeId = "rally" | "paris" | "sw19" | "flushing" | "melbourne";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  caption: string;
  /** page, hero, accent — for the three-circle swatch. Copies of themes.css. */
  swatch: [string, string, string];
  /**
   * This theme's --status-bg, for the browser chrome BEFORE the stylesheet is
   * readable. The boot script runs in <head> and cannot rely on computed
   * style, so the one place a theme's colour has to exist in JavaScript is
   * here. themes.css stays authoritative: applyTheme() reads the computed
   * value, and ThemePicker calls it on mount, so a drift between the two is
   * corrected the moment React hydrates.
   */
  status: string;
}

export const THEMES: ThemeOption[] = [
  { id: "rally", name: "Rally", caption: "Default", swatch: ["#16271F", "#F4EFE3", "#E9C46A"], status: "#16271F" },
  { id: "paris", name: "Paris", caption: "Clay", swatch: ["#F3ECE2", "#B9502B", "#A8451F"], status: "#B9502B" },
  { id: "sw19", name: "SW19", caption: "Grass", swatch: ["#F7F4EC", "#1F5B3A", "#1F5B3A"], status: "#1F5B3A" },
  { id: "flushing", name: "Flushing", caption: "New York hard court", swatch: ["#0B1220", "#8FE3FF", "#FF8A5B"], status: "#0B1220" },
  { id: "melbourne", name: "Melbourne", caption: "Melbourne hard court", swatch: ["#EAF3FB", "#0B5FB5", "#0B5FB5"], status: "#0B5FB5" },
];

export const DEFAULT_THEME: ThemeId = "rally";
export const THEME_STORAGE_KEY = "rally-theme";

export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === "string" && THEMES.some((t) => t.id === v);

export const themeName = (id: ThemeId): string =>
  THEMES.find((t) => t.id === id)?.name || "Rally";

/**
 * Apply a theme to the document, and to the browser chrome with it.
 *
 * The meta theme-color is read back off the computed style, so themes.css
 * stays the authority on what a theme's chrome colour is; ThemeOption.status
 * is only the pre-stylesheet guess the boot script needs, and is used here
 * solely as a fallback. Calling this on mount is therefore what corrects the
 * guess if the two ever disagree.
 */
export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = id;
  try {
    const computed = getComputedStyle(document.documentElement).getPropertyValue("--status-bg").trim();
    const bg = computed || THEMES.find((t) => t.id === id)?.status || "";
    if (bg) {
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", bg);
    }
  } catch { /* the theme still applied; only the status bar missed out */ }
}

export function readStoredTheme(): ThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : null;
  } catch { return null; }
}

export function storeTheme(id: ThemeId): void {
  try { window.localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* a preference, not a requirement */ }
}

/**
 * The script that runs in <head> before first paint.
 *
 * Without it the page renders as rally and then swaps, which on paris or
 * melbourne is a full-screen flash of dark green — the single most visible
 * thing that can go wrong with a theme picker. It is inline and synchronous
 * on purpose: anything deferred is by definition after the paint it exists to
 * beat.
 *
 * It is stringified rather than imported because it has to run before React,
 * before hydration, and before any bundle has loaded.
 *
 * IT SETS THE META THEME-COLOUR AS WELL AS THE ATTRIBUTE, and that is not
 * belt and braces. layout.tsx declares a static themeColor, so without this
 * a melbourne user opened the app to a blue screen under a dark green status
 * bar — not a flash but a permanent mismatch, since nothing called
 * applyTheme() on a plain load. It cannot read the colour off computed style
 * here because the stylesheet may not have arrived yet, which is why
 * ThemeOption carries `status`.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},d=${JSON.stringify(DEFAULT_THEME)};
var ok=${JSON.stringify(THEMES.map((t) => t.id))};
var bg=${JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.id, t.status])))};
var v=localStorage.getItem(k);v=ok.indexOf(v)>-1?v:d;
document.documentElement.setAttribute('data-theme',v);
var m=document.querySelector('meta[name="theme-color"]');
if(!m){m=document.createElement('meta');m.setAttribute('name','theme-color');document.head.appendChild(m);}
m.setAttribute('content',bg[v]);
}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;
