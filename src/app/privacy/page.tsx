import type { Metadata } from "next";
import { FEED_CARD, FEED_LIME, FEED_PAGE, FEED_TEXT_HI, FEED_TEXT_MID, body, display } from "@/lib/theme";

/**
 * /privacy — the plain-English privacy page (Sam, 2026-10-24).
 *
 * Linked from sign-up and from the menu. Short on purpose: what is stored,
 * why, who sees it, that it is never sold, and how to delete it. If anything
 * here stops being true — a new kind of data, a new service handling it —
 * this page changes in the same commit.
 */
export const metadata: Metadata = { title: "Privacy · Southwood" };

const sections: Array<{ heading: string; body: string[] }> = [
  {
    heading: "What we keep",
    body: [
      "Your name and email address, and a photo if you add one.",
      "Your results: who you played, when, the score and who won. Also your level, if it is set, and anything you post or message in the app.",
    ],
  },
  {
    heading: "Why",
    body: [
      "To run your club's tables, ratings, fixtures and match history, and to let you sign in.",
      "Your email is used to sign you in and, unless you switch them off in My profile, to tell you about matches you are in.",
    ],
  },
  {
    heading: "Who sees it",
    body: [
      "Members of your clubs see your name, photo and results. Signed-in players can find your profile and record.",
      "We never sell your information and never share it with anyone else. The companies that host the app, its database and its emails handle it only to run Southwood for us.",
    ],
  },
  {
    heading: "Deleting your account",
    body: [
      "Profile → menu → Edit my profile → Delete my account. Your name, email, photo, messages and friends are removed straight away.",
      "Your match results stay in your clubs as \"Former player\", because every result is also somebody else's match, and removing it would change their ratings.",
    ],
  },
  {
    heading: "Who we are",
    body: [
      "Southwood is run by Southwood HT Ltd, registered with the Information Commissioner's Office (ICO), reference ZB890566.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: FEED_PAGE, padding: "28px 16px 48px", paddingTop: "calc(28px + env(safe-area-inset-top))", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <a href="/" style={{ fontFamily: body, fontSize: 14, color: FEED_LIME, textDecoration: "none" }}>‹ Back to Southwood</a>
        <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: 34, color: FEED_TEXT_HI, margin: "16px 0 6px", lineHeight: 1.1 }}>Privacy</h1>
        <p style={{ fontFamily: body, fontSize: 15, color: FEED_TEXT_MID, lineHeight: 1.55, margin: "0 0 18px" }}>
          What Southwood keeps about you, and why. In plain English.
        </p>
        {sections.map((s) => (
          <section key={s.heading} style={{ background: FEED_CARD, borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
            <h2 style={{ fontFamily: body, fontWeight: 500, fontSize: 18, color: FEED_TEXT_HI, margin: "0 0 6px" }}>{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} style={{ fontFamily: body, fontSize: 14, color: FEED_TEXT_MID, lineHeight: 1.55, margin: i ? "8px 0 0" : 0 }}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
