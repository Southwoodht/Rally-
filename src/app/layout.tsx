import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  Bricolage_Grotesque, Cormorant_Garamond, DM_Sans, Fraunces, Sora, Space_Grotesk,
} from "next/font/google";
import { THEME_BOOT_SCRIPT } from "@/lib/themes";
import "./globals.css";

// The two faces, loaded once, here.
//
// They used to be a Google Fonts @import string injected into a <style> tag
// by six different components — so six screens fetched a stylesheet from
// inside the render tree, and the fonts arrived late enough to shift the
// layout. next/font self-hosts them, inlines the face declarations and
// eliminates the round trip.
//
// Both are variable fonts, so no weight list: every weight in range is
// available and the brief's 600/700/800 and 400/500/600 all resolve. The opsz
// axis is requested explicitly because Bricolage's optical sizing is most of
// what makes it work at 64px AND at 15px, and next/font drops axes it is not
// told about.
//
// The CSS variables are named after the FACE, not the role. themes.css maps
// role to face (--font-display: var(--font-bricolage)), which is what lets a
// future theme swap in Fraunces by editing one block.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bricolage",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dmsans",
});

// The other four themes' display faces.
//
// preload: false on all of them, and only Bricolage stays preloaded. Nearly
// everybody is on rally, and preloading five display faces would have every
// visitor download four they will never render — the cost lands on the first
// paint, which is the one thing a font strategy is supposed to protect.
//
// The variables are named for the FACE. themes.css maps role to face, so a
// theme block says --font-display: var(--font-fraunces) and nothing else in
// the app knows which theme is on.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], display: "swap", preload: false, variable: "--font-fraunces" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["600", "700"], display: "swap", preload: false, variable: "--font-cormorant" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", preload: false, variable: "--font-space-grotesk" });
const sora = Sora({ subsets: ["latin"], weight: ["600", "700"], display: "swap", preload: false, variable: "--font-sora" });

/** Every face's variable, so any theme can resolve its display font. */
const FONT_VARS = [bricolage, dmSans, fraunces, cormorant, spaceGrotesk, sora]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Rally",
  description: "Head-to-head rankings for racket sports.",
  manifest: "/manifest.json",
  icons: {
    // The .ico first and unsized, because a browser asks for /favicon.ico
    // whether or not anything links to it and will take whatever it finds.
    // The SVG after it: browsers that prefer it get a mark that stays sharp
    // at any tab size, and the PNGs remain for the ones that do not.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // 180 is the size iOS actually wants for a home-screen icon.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rally",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Matches --bg-page. Not a variable: the browser reads this before any
  // stylesheet, to colour the status bar and the splash.
  themeColor: "#16271F",
  // WITHOUT THIS, env(safe-area-inset-*) IS ZERO ON iOS.
  //
  // The shell has carried padding-top: env(safe-area-inset-top) since the
  // Home rebuild and the league bar still sat under the status bar, which
  // looked like the padding being overridden by something. It was not: the
  // inset only reports a real value when the page has opted into drawing
  // under the notch, and that opt-in is here rather than in any stylesheet.
  // Every safe-area rule in the app was evaluating to 0px.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme is what themes.css keys on. "rally" is also the :root
    // default, so the app is correct even if this attribute never arrives —
    // and later the theme picker changes this one value and nothing else.
    // data-theme is set here AND by the boot script below. The attribute here
    // is the server's guess (always rally); the script corrects it from
    // localStorage before the first paint. Without the script, somebody on
    // paris loads a full screen of dark green and then watches it turn clay —
    // the single most visible thing a theme picker can get wrong.
    // suppressHydrationWarning is required, not tidying. The server always
    // sends rally and the boot script always rewrites it before React looks,
    // so on any other theme React finds an attribute it did not render and
    // logs a mismatch on every single load. It suppresses this one element's
    // attribute diff and nothing inside it.
    <html lang="en" data-theme="rally" className={FONT_VARS} suppressHydrationWarning>
      <head>
        {/* Inline and synchronous on purpose: anything deferred runs after
            the paint this exists to beat. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
