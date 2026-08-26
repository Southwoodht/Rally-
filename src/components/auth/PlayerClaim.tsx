"use client";

import React, { useState } from "react";

type Player = {
  id: string;
  display_name?: string;
  name?: string;
};

type PlayerClaimProps = {
  player: Player;
  onClaim: () => Promise<void> | void;
  onNotMe: () => void;
};

export default function PlayerClaim({
  player,
  onClaim,
  onNotMe,
}: PlayerClaimProps) {
  const [busy, setBusy] = useState(false);

  async function claim() {
    if (busy) return;

    setBusy(true);

    try {
      await onClaim();
    } finally {
      setBusy(false);
    }
  }

  const playerName = player.display_name ?? player.name ?? "this player";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 28,
          borderRadius: 18,
          border: "1px solid #ddd",
          textAlign: "center",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Is this you?</h1>

        <p style={{ fontSize: 18, marginBottom: 24 }}>
          We found an existing Rally player called{" "}
          <strong>{playerName}</strong>.
        </p>

        <button
          onClick={claim}
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px 16px",
            marginBottom: 10,
            border: 0,
            borderRadius: 14,
            cursor: busy ? "default" : "pointer",
            fontWeight: 700,
          }}
        >
          {busy ? "Connecting..." : "Yes, this is me"}
        </button>

        <button
          onClick={onNotMe}
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            cursor: busy ? "default" : "pointer",
            fontWeight: 700,
          }}
        >
          No, that's not me
        </button>
      </div>
    </div>
  );
}