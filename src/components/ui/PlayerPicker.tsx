"use client";
import React, { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarPicker } from "@/components/ui/AvatarPicker";
import { uid } from "@/lib/format";
import { normalizePlayerName } from "@/lib/historyImport";
import { BALL, CHALK, CLAY, COURT, MUTED, PANEL, PANEL2, body, input, miniInput, mono } from "@/lib/theme";

// Reusable "pick an existing player, or create a new one" control.
// Used anywhere a player needs selecting — Compare, Log Result, and future
// features — so there is exactly one place that knows how to search players
// and one place that knows how to create them without duplicating someone
// who already exists.
export function PlayerPicker({ players, value, onChange, onCreatePlayer, exclude, placeholder = "Select player…" }: any) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [newIsAccount, setNewIsAccount] = useState(false);
  const [collision, setCollision] = useState<any>(null);
  const [err, setErr] = useState("");

  const selected = players.find((p) => p.id === value);
  const list = players.filter((p) => p.id !== exclude);
  const term = q.trim().toLowerCase();
  const shown = term ? list.filter((p) => ((p.name || "") + " " + (p.last || "") + " " + (p.nick || "")).toLowerCase().includes(term)) : list;

  const reset = () => { setMode("pick"); setQ(""); setNewName(""); setNewLast(""); setNewAvatar(null); setNewIsAccount(false); setCollision(null); setErr(""); };
  const close = () => { setOpen(false); reset(); };
  const pick = (id: string) => { onChange(id); close(); };

  const tryCreate = () => {
    const nm = newName.trim();
    if (!nm) { setErr("Enter a name."); return; }
    const full = normalizePlayerName(nm + " " + newLast.trim());
    const existing = players.find((p) => normalizePlayerName((p.name || "") + " " + (p.last || "")) === full);
    if (existing && !collision) { setCollision(existing); return; }
    const created = { id: uid(), name: nm, last: newLast.trim() || undefined, avatar: newAvatar, auth_id: null };
    onCreatePlayer(created);
    pick(created.id);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...input, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%", boxSizing: "border-box" as const, textAlign: "left" }}>
        {selected ? (
          <>
            <Avatar player={selected} size={22} />
            <span style={{ fontFamily: body, fontSize: 14, color: CHALK, flex: 1 }}>{selected.name}{selected.last ? " " + selected.last : ""}</span>
          </>
        ) : <span style={{ fontFamily: body, fontSize: 14, color: MUTED, flex: 1 }}>{placeholder}</span>}
        <span style={{ color: MUTED, fontFamily: body, fontSize: 12 }}>▾</span>
      </button>

      {open && (
        <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 97 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "82vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "none", padding: "18px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: CHALK }}>{mode === "pick" ? "Select player" : "New player"}</div>
              <button onClick={close} style={{ background: "transparent", border: "none", color: MUTED, borderRadius: 10, padding: "5px 12px", fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
            </div>

            {mode === "pick" ? (
              <>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players…" autoFocus style={{ ...miniInput, fontFamily: body, width: "100%", marginBottom: 12, boxSizing: "border-box" as const }} />
                <button onClick={() => setMode("create")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: PANEL, border: "1px solid " + BALL, borderRadius: 14, padding: "11px 12px", marginBottom: 12, cursor: "pointer", color: BALL, fontFamily: body, fontSize: 14, fontWeight: 700 }}>
                  <span style={{ fontSize: 16 }}>＋</span> Create new player
                </button>
                {shown.length === 0 && <div style={{ fontFamily: body, fontSize: 13, color: MUTED, padding: "10px 0" }}>No players match.</div>}
                {shown.map((p) => (
                  <button key={p.id} onClick={() => pick(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", borderTop: "none", padding: "10px 2px", cursor: "pointer", textAlign: "left" }}>
                    <Avatar player={p} size={32} />
                    <span style={{ flex: 1, fontFamily: body, fontSize: 15, color: CHALK }}>{p.name}{p.last ? " " + p.last : ""}</span>
                    <span style={{ fontFamily: body, fontWeight: 600, fontSize: 11, color: MUTED }}>{p.auth_id ? "Account" : "Shell"}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input value={newName} onChange={(e) => { setNewName(e.target.value); setCollision(null); }} placeholder="First name" style={{ ...input, flex: 1, boxSizing: "border-box" as const }} />
                  <input value={newLast} onChange={(e) => { setNewLast(e.target.value); setCollision(null); }} placeholder="Surname (optional)" style={{ ...input, flex: 1, boxSizing: "border-box" as const }} />
                </div>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, margin: "10px 0 6px" }}>Avatar</div>
                <div style={{ marginBottom: 12 }}>
                  <AvatarPicker value={newAvatar} onChange={setNewAvatar} />
                </div>
                <div style={{ fontFamily: body, fontWeight: 600, fontSize: 12.5, color: MUTED, margin: "10px 0 6px" }}>Player type</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <button onClick={() => setNewIsAccount(false)} style={{ flex: 1, fontFamily: body, fontSize: 13, padding: "10px 6px", borderRadius: 12, cursor: "pointer", border: "none", background: !newIsAccount ? BALL : PANEL2, color: !newIsAccount ? COURT : MUTED, fontWeight: 600 }}>Shell player</button>
                  <button onClick={() => setNewIsAccount(true)} style={{ flex: 1, fontFamily: body, fontSize: 13, padding: "10px 6px", borderRadius: 12, cursor: "pointer", border: "none", background: newIsAccount ? BALL : PANEL2, color: newIsAccount ? COURT : MUTED, fontWeight: 600 }}>Has a Rally account</button>
                </div>
                <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED, marginBottom: 14, lineHeight: 1.4 }}>
                  {newIsAccount
                    ? "They'll need to sign in and use “Is this you?” themselves to link their real account and inherit this history — nothing here logs them in automatically."
                    : "No account needed. Their record stays exactly like this until (and unless) they sign in and claim it."}
                </div>
                {collision && (
                  <div style={{ background: PANEL2, border: "1px solid " + CLAY, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                    {collision.id === exclude ? (
                      <div style={{ fontFamily: body, fontSize: 13, color: CHALK }}><strong>{collision.name}{collision.last ? " " + collision.last : ""}</strong> is already picked in the other slot — choose a different name, or continue below to create a separate person who happens to share it.</div>
                    ) : (
                      <>
                        <div style={{ fontFamily: body, fontSize: 13, color: CHALK, marginBottom: 8 }}>A player called <strong>{collision.name}{collision.last ? " " + collision.last : ""}</strong> already exists.</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => pick(collision.id)} style={{ flex: 1, fontFamily: body, fontSize: 13, padding: "9px 6px", borderRadius: 12, cursor: "pointer", border: "none", background: BALL, color: COURT, fontWeight: 600 }}>Use them</button>
                          <button onClick={tryCreate} style={{ flex: 1, fontFamily: body, fontSize: 13, padding: "9px 6px", borderRadius: 12, cursor: "pointer", border: "none", background: "transparent", color: MUTED, fontWeight: 600 }}>Different person</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {err && <div style={{ color: CLAY, fontFamily: body, fontSize: 13, marginBottom: 10 }}>{err}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setMode("pick")} style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 15, padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: "none", background: "transparent", color: MUTED }}>Back</button>
                  {(!collision || collision.id === exclude) && <button onClick={tryCreate} style={{ flex: 1, fontFamily: body, fontWeight: 600, fontSize: 15, padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: "none", background: BALL, color: COURT }}>Create</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
