"use client";
import React from "react";
import { CHALK, FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * When a screen crashes, say what broke and offer a way back — instead of
 * Next's blank "Application error: a client-side exception has occurred",
 * which tells a phone user nothing and leaves them nowhere (Sam, 2026-11-02:
 * tapping Doubles did exactly that, and it could not be reproduced here).
 *
 * The message is shown small on purpose: it is what turns "it crashed" into a
 * screenshot that names the line. "Back to Home" remounts what is inside, so
 * the club reloads fresh on Home and Singles rather than re-drawing the state
 * that just broke.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null; n: number }> {
  state = { error: null as Error | null, n: 0 };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Screen crashed", error, info?.componentStack);
  }

  render() {
    const { error, n } = this.state;
    if (!error) return <React.Fragment key={n}>{this.props.children}</React.Fragment>;
    const where = (error.stack || "").split("\n").slice(0, 4).join("\n");
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ background: FEED_CARD, borderRadius: 20, padding: 22, maxWidth: 440, width: "100%", fontFamily: body }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: CHALK, marginBottom: 6 }}>Something went wrong on that screen</div>
          <div style={{ fontWeight: 500, fontSize: 15, color: FEED_TEXT_MID, lineHeight: 1.45, marginBottom: 14 }}>
            Nothing has been lost. A screenshot of this helps fix it.
          </div>
          <pre style={{ fontSize: 12, color: FEED_TEXT_MID, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 18px", maxHeight: 180, overflow: "auto" }}>
            {String(error.message || error)}{where ? "\n\n" + where : ""}
          </pre>
          <button
            onClick={() => this.setState({ error: null, n: n + 1 })}
            style={{ width: "100%", padding: "13px 16px", borderRadius: 999, border: "none", background: FEED_LIME, color: FEED_LIME_INK, fontFamily: body, fontWeight: 600, fontSize: 16, cursor: "pointer" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
}
