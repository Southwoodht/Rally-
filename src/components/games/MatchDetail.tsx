"use client";
import React, { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { matchContext } from "@/core/rank";
import { fmtDate } from "@/lib/format";
import { readPhotoAsDataUrl } from "@/lib/photo";
import { BALL, CHALK, CLAY, COURT, LINE, MUTED, PANEL2, body, display, miniInput, mono } from "@/lib/theme";

const PHOTO_SIZE = 480;

export function MatchDetail({ match, players, matches, nameOf, onClose, onOpenProfile, meId, onProposeEdit, onUpdateExtras, onDeleteMatch, groupName, season }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [venueDraft, setVenueDraft] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!match) return null;
  const byId: Record<string, any> = {}; (players || []).forEach((p) => { byId[p.id] = p; });
  const p1 = byId[match.p1], p2 = byId[match.p2];
  const nm = (id: string) => byId[id]?.name ? (byId[id].name + (byId[id].last ? " " + byId[id].last : "")) : nameOf(id);
  const isDraw = match.winner === "draw";
  const p1Won = match.winner === "p1", p2Won = match.winner === "p2";
  const canEdit = !!(onProposeEdit && meId && (match.p1 === meId || match.p2 === meId));
  const oppOf = (selfId: string) => byId[selfId === match.p1 ? match.p2 : match.p1];
  const opponentOfMe = meId ? oppOf(meId) : null;
  const needsApproval = !!(opponentOfMe && opponentOfMe.auth_id);

  const ctx = matchContext(players, matches, match);
  const confirmedH2h = (matches || []).filter((m: any) => m.status !== "pending" && ((m.p1 === match.p1 && m.p2 === match.p2) || (m.p1 === match.p2 && m.p2 === match.p1)));
  let h2hP1 = 0, h2hP2 = 0, h2hD = 0;
  confirmedH2h.forEach((m: any) => { if (m.winner === "draw") h2hD++; else if ((m.winner === "p1" && m.p1 === match.p1) || (m.winner === "p2" && m.p2 === match.p1)) h2hP1++; else h2hP2++; });

  const inSeason = season && match.date >= season.start && (season.end == null || match.date <= season.end);

  const prediction = match.prediction;
  const favoredId = prediction ? (prediction.p1Pct >= 50 ? match.p1 : match.p2) : null;
  const favoredPct = prediction ? (prediction.p1Pct >= 50 ? prediction.p1Pct : 100 - prediction.p1Pct) : null;
  const predictionResolved = match.status !== "pending" && !isDraw;
  const predictionCorrect = predictionResolved && favoredId ? ((match.winner === "p1" && favoredId === match.p1) || (match.winner === "p2" && favoredId === match.p2)) : null;

  const beginEdit = () => {
    setDraft({ date: new Date(match.date).toISOString().slice(0, 10), score: match.score || "", result: isDraw ? "D" : p1Won ? "W1" : "W2" });
    setEditing(true);
  };
  const saveEdit = () => {
    if (!draft) return;
    const winner = draft.result === "D" ? "draw" : draft.result === "W1" ? "p1" : "p2";
    onProposeEdit(match.id, { date: draft.date ? new Date(draft.date).getTime() : match.date, score: draft.score.trim(), winner });
    setEditing(false);
    setDraft(null);
  };

  const confirmedDelete = () => { onDeleteMatch && onDeleteMatch(match.id); onClose && onClose(); };

  const saveNotes = () => { if (notesDraft === null) return; onUpdateExtras && onUpdateExtras(match.id, { notes: notesDraft.trim() || undefined }); setNotesDraft(null); };
  const saveVenue = () => { if (venueDraft === null) return; onUpdateExtras && onUpdateExtras(match.id, { venue: venueDraft.trim() || undefined }); setVenueDraft(null); };

  const onPickPhoto = async (file: File) => {
    try {
      const dataUrl = await readPhotoAsDataUrl(file, PHOTO_SIZE);
      onUpdateExtras && onUpdateExtras(match.id, { photoUrl: dataUrl });
    } catch {
      setFlash("Couldn't read that photo — try a different one");
      setTimeout(() => setFlash(""), 2500);
    }
  };

  const Row = ({ label, children }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderTop: "1px solid " + LINE, gap: 12 }}>
      <span style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: body, fontSize: 13, color: CHALK, textAlign: "right" }}>{children}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 90 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COURT, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, border: "1px solid " + LINE, padding: "20px 18px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>Match detail</div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + LINE, color: MUTED, borderRadius: 6, padding: "4px 10px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>Close</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <button onClick={() => onOpenProfile && onOpenProfile(match.p1)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "8px 4px", borderRadius: 10, opacity: isDraw || p1Won ? 1 : 0.55 }}>
            <Avatar player={p1 || { id: match.p1, name: "?" }} size={44} />
            <span style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: CHALK, textTransform: "uppercase", textAlign: "center" }}>{nm(match.p1)}</span>
          </button>
          <span style={{ fontFamily: mono, fontSize: 11, color: MUTED }}>vs</span>
          <button onClick={() => onOpenProfile && onOpenProfile(match.p2)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "8px 4px", borderRadius: 10, opacity: isDraw || p2Won ? 1 : 0.55 }}>
            <Avatar player={p2 || { id: match.p2, name: "?" }} size={44} />
            <span style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: CHALK, textTransform: "uppercase", textAlign: "center" }}>{nm(match.p2)}</span>
          </button>
        </div>
        <div style={{ textAlign: "center", fontFamily: mono, fontSize: 11, color: BALL, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          {isDraw ? "Draw" : p1Won ? nm(match.p1) + " won" : nm(match.p2) + " won"}
        </div>
        <div style={{ textAlign: "center", fontFamily: mono, fontSize: 12, color: MUTED, marginBottom: 4 }}>{fmtDate(match.date)}{match.score ? " · " + match.score : ""}</div>
        {match.status === "pending" && <div style={{ textAlign: "center", fontFamily: mono, fontSize: 10, color: BALL, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Awaiting confirmation</div>}
        {match.pendingEdit && <div style={{ textAlign: "center", fontFamily: mono, fontSize: 10, color: BALL, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Edit pending agreement</div>}

        <Row label="Competition">{inSeason ? season.name : (groupName || "—")}</Row>
        {match.category && <Row label="Category">{match.category}</Row>}
        {(venueDraft !== null || match.venue) ? (
          venueDraft !== null ? (
            <div style={{ display: "flex", gap: 6, padding: "8px 0", borderTop: "1px solid " + LINE, alignItems: "center" }}>
              <span style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, flexShrink: 0 }}>Venue</span>
              <input value={venueDraft} onChange={(e) => setVenueDraft(e.target.value)} style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
              <button onClick={saveVenue} style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, border: "none", borderRadius: 5, padding: "6px 8px", cursor: "pointer" }}>Save</button>
            </div>
          ) : (
            <div onClick={() => canEdit && setVenueDraft(match.venue || "")} style={{ padding: "8px 0", borderTop: "1px solid " + LINE, cursor: canEdit ? "pointer" : "default" }}>
              <Row label="Venue">{match.venue}</Row>
            </div>
          )
        ) : canEdit ? (
          <button onClick={() => setVenueDraft("")} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: "1px solid " + LINE, padding: "8px 0", color: BALL, fontFamily: mono, fontSize: 11, cursor: "pointer" }}>+ Add venue</button>
        ) : null}

        {ctx && (
          <>
            <Row label="ELO">
              {nm(match.p1)} {Math.round(ctx.eloBefore.p1)} → {Math.round(ctx.eloAfter.p1)}
              <br />{nm(match.p2)} {Math.round(ctx.eloBefore.p2)} → {Math.round(ctx.eloAfter.p2)}
            </Row>
            {(ctx.rankBefore.p1 || ctx.rankBefore.p2) && (
              <Row label="Official rank">
                {nm(match.p1)} {ctx.rankBefore.p1 ? "#" + ctx.rankBefore.p1 : "unranked"} → {ctx.rankAfter.p1 ? "#" + ctx.rankAfter.p1 : "unranked"}
                <br />{nm(match.p2)} {ctx.rankBefore.p2 ? "#" + ctx.rankBefore.p2 : "unranked"} → {ctx.rankAfter.p2 ? "#" + ctx.rankAfter.p2 : "unranked"}
              </Row>
            )}
          </>
        )}

        <Row label="Head-to-head">{h2hP1 === h2hP2 ? `${h2hP1}-${h2hD}-${h2hP2} · even` : h2hP1 > h2hP2 ? `${nm(match.p1)} leads ${h2hP1}-${h2hD}-${h2hP2}` : `${nm(match.p2)} leads ${h2hP2}-${h2hD}-${h2hP1}`}</Row>

        {prediction && (
          <Row label="Rally predicted">
            {nm(favoredId)} {favoredPct}%
            {predictionCorrect != null && <span style={{ marginLeft: 8, color: predictionCorrect ? BALL : CLAY, fontWeight: 700 }}>{predictionCorrect ? "Correct ✓" : "Incorrect ✗"}</span>}
          </Row>
        )}

        <div style={{ padding: "10px 0", borderTop: "1px solid " + LINE }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 6 }}>Note</div>
          {notesDraft !== null ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="e.g. Came back from 4–1 down" style={{ ...miniInput, flex: 1, boxSizing: "border-box" as const }} />
              <button onClick={saveNotes} style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, border: "none", borderRadius: 5, padding: "6px 8px", cursor: "pointer" }}>Save</button>
            </div>
          ) : match.notes ? (
            <div onClick={() => canEdit && setNotesDraft(match.notes)} style={{ fontFamily: body, fontSize: 14, color: CHALK, fontStyle: "italic", cursor: canEdit ? "pointer" : "default" }}>“{match.notes}”</div>
          ) : canEdit ? (
            <button onClick={() => setNotesDraft("")} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 11, cursor: "pointer", padding: 0 }}>+ Add a note</button>
          ) : (
            <div style={{ fontFamily: body, fontSize: 13, color: MUTED }}>No note.</div>
          )}
        </div>

        <div style={{ padding: "10px 0", borderTop: "1px solid " + LINE }}>
          <div style={{ fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTED, marginBottom: 6 }}>Photo</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickPhoto(f); e.target.value = ""; }} />
          {match.photoUrl ? (
            <div>
              <img src={match.photoUrl} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, border: "1px solid " + LINE, marginBottom: canEdit ? 8 : 0 }} />
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => fileRef.current?.click()} style={{ ...miniInput, cursor: "pointer", color: BALL }}>Change photo</button>
                  <button onClick={() => onUpdateExtras && onUpdateExtras(match.id, { photoUrl: null })} style={{ ...miniInput, cursor: "pointer", color: MUTED, flex: "0 0 auto" }}>Remove</button>
                </div>
              )}
            </div>
          ) : canEdit ? (
            <button onClick={() => fileRef.current?.click()} style={{ background: "transparent", border: "none", color: BALL, fontFamily: mono, fontSize: 11, cursor: "pointer", padding: 0 }}>+ Add a photo</button>
          ) : (
            <div style={{ fontFamily: body, fontSize: 13, color: MUTED }}>No photo.</div>
          )}
          {flash && <div style={{ fontFamily: body, fontSize: 12, color: CLAY, marginTop: 6 }}>{flash}</div>}
        </div>

        {canEdit && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid " + LINE }}>
            {editing ? (
              <div style={{ display: "grid", gap: 6 }}>
                <input type="date" value={draft.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ ...miniInput, colorScheme: "dark", boxSizing: "border-box" as const }} />
                <input value={draft.score} onChange={(e) => setDraft({ ...draft, score: e.target.value })} placeholder="Score (optional)" style={{ ...miniInput, boxSizing: "border-box" as const }} />
                <div style={{ display: "flex", gap: 6 }}>
                  {([["W1", nm(match.p1)], ["D", "Draw"], ["W2", nm(match.p2)]] as const).map(([r, label]) => (
                    <button key={r} onClick={() => setDraft({ ...draft, result: r })} style={{ flex: 1, fontFamily: mono, fontSize: 11, padding: "8px 6px", borderRadius: 6, cursor: "pointer", border: "1px solid " + (draft.result === r ? BALL : LINE), background: draft.result === r ? BALL : "transparent", color: draft.result === r ? COURT : MUTED, fontWeight: 700 }}>{label}</button>
                  ))}
                </div>
                <div style={{ fontFamily: body, fontSize: 11.5, color: MUTED }}>{needsApproval ? "This needs their agreement before it counts." : "Updates straight away — no account on the other side."}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveEdit} style={{ fontFamily: mono, fontSize: 10, color: COURT, background: BALL, border: "none", borderRadius: 5, padding: "7px 10px", cursor: "pointer", textTransform: "uppercase", fontWeight: 700 }}>Save</button>
                  <button onClick={() => { setEditing(false); setDraft(null); }} style={{ fontFamily: mono, fontSize: 10, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "7px 10px", cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
                </div>
              </div>
            ) : confirmDelete ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontFamily: display, fontSize: 15, fontWeight: 800, color: CHALK, textTransform: "uppercase" }}>Delete this match?</div>
                <div style={{ fontFamily: body, fontSize: 12.5, color: CLAY }}>This match will be permanently deleted. This cannot be undone.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={confirmedDelete} style={{ flex: 1, fontFamily: mono, fontSize: 11, color: COURT, background: CLAY, border: "none", borderRadius: 6, padding: "9px 10px", cursor: "pointer", textTransform: "uppercase", fontWeight: 700 }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, fontFamily: mono, fontSize: 11, color: MUTED, background: "transparent", border: "1px solid " + LINE, borderRadius: 6, padding: "9px 10px", cursor: "pointer", textTransform: "uppercase" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={beginEdit} style={{ fontFamily: mono, fontSize: 10, color: BALL, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "7px 10px", cursor: "pointer", textTransform: "uppercase" }}>Edit result</button>
                {onDeleteMatch && <button onClick={() => setConfirmDelete(true)} style={{ fontFamily: mono, fontSize: 10, color: CLAY, background: "transparent", border: "1px solid " + LINE, borderRadius: 5, padding: "7px 10px", cursor: "pointer", textTransform: "uppercase" }}>Delete match</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
