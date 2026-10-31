"use client";
import React from "react";
import {
  FEED_CARD, FEED_HAIRLINE, FEED_PAGE, FEED_TEXT_HI, FEED_TEXT_MID, body, display,
} from "@/lib/theme";

/**
 * The public front page at southwood.app, for signed-out visitors (Sam,
 * 2026-10-31). AuthGate shows it; a signed-in visitor never sees it — the
 * boot attribute in layout.tsx hides it before the first paint when a saved
 * session is on the device.
 *
 * Always the Southwood theme (cream, brass, ink), whatever the device last
 * picked: data-theme="rally" on the wrapper re-scopes every token. The
 * screenshots in /public/landing are the app's own components photographed
 * with invented players — never real members' names on a public page. The
 * names are Sam's (2026-10-31): Dexter W, Russell J (the "you"), Buddy T,
 * Stanley S, Jamie V, Alfie M, Freddie C, Harry A, at "Riverside RC".
 *
 * The contact address is CONTACT_EMAIL. southwood.app has no inbox of its
 * own (Resend only sends), so it needs email forwarding set up at Porkbun
 * before mail to it arrives anywhere.
 */
export const CONTACT_EMAIL = "hello@southwood.app";

const SPORTS = "tennis, padel, racketball, squash and pickleball";

export default function Landing({ onSignIn, onJoin }: { onSignIn: () => void; onJoin: () => void }) {
  return (
    <div data-theme="rally" className="lp" style={{ minHeight: "100vh", background: FEED_PAGE, color: FEED_TEXT_HI, fontFamily: body }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="lp-bar">
        <a href="/" className="lp-brand" aria-label="Southwood home">
          <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 9 }} />
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 20 }}>Southwood</span>
        </a>
        <button onClick={onSignIn} className="lp-btn lp-ghost lp-small">Sign in</button>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <h1 style={{ fontFamily: display }}>
              Southwood <span className="lp-dot">·</span> Rankings, leagues and fixtures for racket clubs
            </h1>
            <p className="lp-lead">
              Log a result in seconds, see a fair table of who&apos;s really on top, and run your
              club&apos;s box leagues from your phone. Built for {SPORTS} clubs.
            </p>
            <div className="lp-ctas">
              <button onClick={onJoin} className="lp-btn lp-filled">Join your club</button>
              <button onClick={onSignIn} className="lp-btn lp-ghost">Sign in</button>
            </div>
          </div>
          <div className="lp-phone" aria-hidden="true">
            <div className="lp-phone-screen">
              <img src="/landing/phone-home.png" width={780} height={1688} alt="" />
            </div>
          </div>
        </section>

        <Feature
          kicker="Club tables"
          title="A table everyone trusts"
          text={<>
            Every confirmed result moves a rating that weighs who you beat, not just how often you
            played. New players start from their level and settle as results come in, and under each
            name you can see their head-to-head: how many people they&apos;re ahead of and behind.
            Season and all-time tables, for singles and doubles.
          </>}
          shots={[{ src: "/landing/table.png", w: 860, h: 1042, alt: "A club table: rank, name, head-to-head and rating for each player" }]}
        />

        <Feature
          flip
          kicker="Leagues and fixtures"
          title="Divisions that run themselves"
          text={<>
            Box leagues, divisions and round-robins: the app draws the fixtures, sets the play-by
            dates, keeps the table, marks who goes up and who drops, and plans next season&apos;s
            boxes. Book a match with a time and a court, and everyone gets the email. One tap makes a
            share sheet for the club WhatsApp or the noticeboard: an A4 page or pictures, with a QR
            code back to the live table.
          </>}
          shots={[
            { src: "/landing/division.png", w: 860, h: 946, alt: "A division table with promotion and relegation places" },
            { src: "/landing/sheet.png", w: 860, h: 1060, alt: "A share sheet for the club chat: still to play, latest results and a QR code" },
          ]}
        />

        <Feature
          kicker="Head-to-heads"
          title="Settle the argument"
          text={<>
            Every player gets a head-to-head record: who they&apos;re ahead of, who&apos;s ahead of
            them, their nemesis, their biggest rivalries and their best wins. The hero of every
            profile, and the line under every name in the table. Challenge anyone in the
            club straight from their profile, with the time and the court.
          </>}
          shots={[
            { src: "/landing/h2h-lists.png", w: 780, h: 1120, alt: "Who a player is behind and ahead of, with each head-to-head record" },
            { src: "/landing/h2h-rivals.png", w: 860, h: 774, alt: "Two rivalry cards with head-to-head records" },
          ]}
        />

        <section className="lp-clubs">
          <div className="lp-card" style={{ background: FEED_CARD }}>
            <h2 style={{ fontFamily: display }}>For clubs and coaches</h2>
            <p>
              Southwood is free for members to use. Club organisers and coaches get the tools to run
              it: divisions and box leagues, season awards, corrections, share sheets, a Clubhouse TV
              board, and a say over who joins. Whether you run {SPORTS}, we&apos;d love to set your
              club up.
            </p>
            <div className="lp-email">
              <span style={{ color: FEED_TEXT_MID }}>Email us at</span>{" "}
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Setting up our club on Southwood")}`}>{CONTACT_EMAIL}</a>
            </div>
            <div className="lp-ctas">
              <button onClick={onJoin} className="lp-btn lp-ghost">Join your club</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot" style={{ borderTop: "1px solid " + FEED_HAIRLINE }}>
        <span>© Southwood HT Ltd</span>
        <a href="/privacy">Privacy</a>
        <button onClick={onSignIn} className="lp-link">Sign in</button>
      </footer>
    </div>
  );
}

function Feature({ kicker, title, text, shots, flip }: {
  kicker: string; title: string; text: React.ReactNode; flip?: boolean;
  shots: { src: string; w: number; h: number; alt: string }[];
}) {
  return (
    <section className={"lp-feature" + (flip ? " lp-flip" : "")}>
      <div className="lp-copy">
        <div className="lp-kicker">{kicker}</div>
        <h2 style={{ fontFamily: display }}>{title}</h2>
        <p>{text}</p>
      </div>
      <div className={"lp-shots" + (shots.length > 1 ? " lp-two" : "")}>
        {shots.map((s) => (
          <img key={s.src} src={s.src} width={s.w} height={s.h} alt={s.alt} loading="lazy" decoding="async" style={{ alignSelf: "flex-start" }} />
        ))}
      </div>
    </section>
  );
}

// Plain CSS rather than inline styles because the page changes shape at
// laptop width, and inline styles cannot hold a media query.
const CSS = `
.lp { --lp-ink: var(--text-hi); --lp-mid: var(--text-mid); }
.lp a { color: inherit; }
.lp-bar { display: flex; align-items: center; justify-content: space-between; max-width: 1120px; margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) 20px 14px; }
.lp-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.lp-hero { max-width: 1120px; margin: 0 auto; padding: 32px 20px 28px; text-align: center; display: grid; gap: 40px; justify-items: center; }
.lp-hero-copy { max-width: 640px; }
.lp-phone { width: 290px; border-radius: 46px; padding: 11px; background: #2A2118; box-shadow: 0 30px 70px rgba(42,33,24,0.28), inset 0 0 0 2px #4A3D2E; position: relative; }
.lp-phone::before { content: ""; position: absolute; top: 20px; left: 50%; transform: translateX(-50%); width: 84px; height: 24px; border-radius: 14px; background: #2A2118; z-index: 2; }
.lp-phone-screen { border-radius: 36px; overflow: hidden; background: #F8F4EB; aspect-ratio: 780 / 1688; }
.lp-phone-screen img { width: 100%; height: auto; display: block; }
.lp-email { font-size: 19px; font-weight: 600; margin-top: 22px; word-break: break-word; }
.lp-email a { color: var(--lp-ink); text-decoration: underline; text-decoration-color: #B8955A; text-underline-offset: 4px; }
.lp-hero h1 { font-size: clamp(34px, 7vw, 60px); line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.lp-dot { color: #B8955A; }
.lp-lead { font-size: clamp(17px, 2.4vw, 20px); line-height: 1.5; color: var(--lp-mid); margin: 20px auto 0; max-width: 640px; font-weight: 500; }
.lp-ctas { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 26px; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 50px; padding: 0 26px; border-radius: 999px;
  font-family: inherit; font-weight: 600; font-size: 16px; cursor: pointer; text-decoration: none; border: none; }
.lp .lp-filled { background: linear-gradient(145deg, #E2C98E 0%, #B8955A 100%); color: #2A2118; }
.lp .lp-ghost { background: transparent; color: var(--lp-ink); box-shadow: inset 0 0 0 1.5px var(--lp-ink); }
.lp-small { min-height: 40px; padding: 0 18px; font-size: 15px; }
.lp-feature { max-width: 1120px; margin: 0 auto; padding: 44px 20px; display: grid; gap: 28px; align-items: center; }
.lp-kicker { font-size: 14px; font-weight: 600; color: #8A6F3F; margin-bottom: 8px; }
.lp-feature h2, .lp-clubs h2 { font-size: clamp(28px, 4.4vw, 40px); line-height: 1.1; font-weight: 700; letter-spacing: -0.015em; margin: 0 0 14px; }
.lp-feature p, .lp-clubs p { font-size: 17px; line-height: 1.6; color: var(--lp-mid); margin: 0; font-weight: 500; }
.lp-shots { display: flex; justify-content: center; gap: 16px; }
.lp-shots img { width: 100%; max-width: 380px; height: auto; border-radius: 22px; box-shadow: 0 10px 34px rgba(42,33,24,0.12); background: #F8F4EB; }
.lp-two { flex-direction: column; align-items: center; }
.lp-clubs { max-width: 880px; margin: 0 auto; padding: 36px 20px 56px; }
.lp-card { border-radius: 26px; padding: 30px 24px; box-shadow: inset 0 0 0 1px #E4D6BC; text-align: center; }
.lp-foot { max-width: 1120px; margin: 0 auto; padding: 20px 20px calc(28px + env(safe-area-inset-bottom)); display: flex; gap: 20px;
  flex-wrap: wrap; font-size: 14px; color: var(--lp-mid); }
.lp-foot a { text-decoration: none; }
.lp-link { background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer; }
@media (min-width: 900px) {
  .lp-hero { grid-template-columns: 1.15fr 0.85fr; text-align: left; align-items: center; padding-top: 56px; gap: 56px; }
  .lp-hero .lp-ctas { justify-content: flex-start; }
  .lp-hero .lp-lead { margin-left: 0; }
  .lp-phone { width: 320px; }
  .lp-feature { grid-template-columns: 1fr 1fr; gap: 64px; padding: 64px 32px; }
  .lp-flip .lp-copy { order: 2; }
  .lp-shots img { max-width: 400px; }
  .lp-two { flex-direction: row; align-items: flex-start; }
  .lp-two img { max-width: 260px; }
}
`;
