"use client";
import React, { useState } from "react";
import { FileText, Image as ImageIcon, Share } from "lucide-react";
import { shareSheetImage, shareSheetPdf, type Sheet } from "@/lib/shareSheet";
import { FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

/**
 * "Share sheet" on a competition and on the club night mixer
 * (lib/shareSheet.ts): a portrait picture for the club chat, or an A4 PDF
 * to print and pin up. `build` is called on tap, so the sheet is whatever
 * is on screen at that moment.
 */
export function ShareSheetButton({ build, style }: { build: () => Sheet; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"image" | "pdf" | null>(null);
  const [note, setNote] = useState("");
  const go = async (kind: "image" | "pdf") => {
    if (busy) return;
    setBusy(kind); setNote("");
    try {
      const sheet = build();
      const r = kind === "image" ? await shareSheetImage(sheet) : await shareSheetPdf(sheet);
      if (r === "saved") setNote(kind === "image" ? "Saved as a picture — find it in your downloads." : "Saved as a PDF — find it in your downloads.");
      if (r !== "cancelled") setOpen(false);
    } catch (e: any) {
      setNote(e?.message || "Couldn't make the sheet.");
    }
    setBusy(null);
  };
  const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 999, padding: "8px 14px", fontFamily: body, fontWeight: 600, fontSize: 14, cursor: "pointer" };
  return (
    <div style={style}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={pill}><Share size={15} strokeWidth={2} /> Share sheet</button>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => go("image")} disabled={!!busy} style={{ ...pill, opacity: busy && busy !== "image" ? 0.5 : 1 }}>
            <ImageIcon size={15} strokeWidth={2} /> {busy === "image" ? "Making it…" : "Picture for WhatsApp"}
          </button>
          <button onClick={() => go("pdf")} disabled={!!busy} style={{ ...pill, opacity: busy && busy !== "pdf" ? 0.5 : 1 }}>
            <FileText size={15} strokeWidth={2} /> {busy === "pdf" ? "Making it…" : "A4 PDF"}
          </button>
          <button onClick={() => { setOpen(false); setNote(""); }} style={{ ...pill, background: "transparent", color: FEED_TEXT_MID }}>Cancel</button>
        </div>
      )}
      {note && <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 6 }}>{note}</div>}
    </div>
  );
}
