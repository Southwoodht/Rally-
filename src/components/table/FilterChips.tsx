"use client";
import React, { useState } from "react";
import { MoreHorizontal, Check, Search, X } from "lucide-react";
import { FEED_CARD, FEED_LIME, FEED_LIME_INK, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_LOW, FEED_TEXT_MID, body, input } from "@/lib/theme";

// One scrolling row of chips in place of the stack of controls that used to
// sit between the heading and rank 1.
//
// Every control that was permanently on screen is still reachable; it just
// isn't shouting. A filter you set once and change rarely does not deserve
// the same vertical space as the thing it filters, and there was more
// chrome above the table than table.

export interface FilterOption {
  value: string;
  label: string;
  /** One line under the option in the sheet, when it needs explaining. */
  note?: string;
}

export interface FilterDef {
  key: string;
  /** Shown on the chip when something other than the default is chosen. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

const chipBase: React.CSSProperties = {
  fontFamily: body, fontWeight: 500, fontSize: 13, padding: "7px 13px", borderRadius: 999,
  border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};

function Chip({ label, active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      style={{ ...chipBase, background: active ? FEED_LIME : FEED_RAISED, color: active ? FEED_LIME_INK : FEED_TEXT_MID }}
    >
      {children ?? label}
    </button>
  );
}

function Sheet({ title, children, onClose }: any) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 95 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: FEED_CARD, width: "100%", maxWidth: 620, maxHeight: "80vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "18px 16px 32px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: body, fontWeight: 500, fontSize: 17, color: FEED_TEXT_HI }}>{title}</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: FEED_TEXT_MID, fontFamily: body, fontSize: 14, cursor: "pointer", padding: "4px 6px" }}>Done</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OptionRow({ option, selected, onPick }: { option: FilterOption; selected: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "12px 2px", cursor: "pointer" }}
    >
      <span style={{ width: 18, flexShrink: 0, paddingTop: 2 }}>
        {selected && <Check size={16} color={FEED_LIME} strokeWidth={2.4} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: body, fontWeight: selected ? 500 : 400, fontSize: 15, color: FEED_TEXT_HI }}>{option.label}</span>
        {option.note && <span style={{ display: "block", fontFamily: body, fontWeight: 400, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2, lineHeight: 1.4 }}>{option.note}</span>}
      </span>
    </button>
  );
}

export function FilterChips({ filters, overflow, search }: {
  filters: FilterDef[];
  /** Was a permanent text field above the table. It is a chip now: a box
   *  you use occasionally should not hold a row of the screen open all the
   *  time. Shows the query on the chip when one is set, so an active filter
   *  is never invisible. */
  search?: { value: string; onChange: (v: string) => void };
  /** What sits behind the "..." chip — the ranking explainer, and anything
   *  else read once rather than every visit. */
  overflow?: { title: string; content: React.ReactNode };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const active = filters.find((f) => f.key === open);

  return (
    <>
      {/* Scrolls sideways rather than wrapping: wrapping is how a row of
          chips turns back into the stack of controls it replaced. */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
        {filters.map((f) => {
          const chosen = f.options.find((o) => o.value === f.value);
          return <Chip key={f.key} label={chosen?.label || f.label} active onClick={() => setOpen(f.key)} />;
        })}
        {search && (
          <Chip active={!!search.value} onClick={() => setOpen("__search")} label="Search">
            {search.value
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{search.value}<X size={13} strokeWidth={2.4} onClick={(e: any) => { e.stopPropagation(); search.onChange(""); }} /></span>
              : <Search size={15} strokeWidth={2} style={{ display: "block" }} />}
          </Chip>
        )}
        {overflow && (
          <Chip active={false} onClick={() => setOpen("__overflow")} label="More">
            <MoreHorizontal size={16} strokeWidth={2} style={{ display: "block" }} />
          </Chip>
        )}
      </div>

      {active && (
        <Sheet title={active.label} onClose={() => setOpen(null)}>
          {active.options.map((o) => (
            <OptionRow
              key={o.value}
              option={o}
              selected={o.value === active.value}
              onPick={() => { active.onChange(o.value); setOpen(null); }}
            />
          ))}
        </Sheet>
      )}
      {open === "__search" && search && (
        <Sheet title="Find a player" onClose={() => setOpen(null)}>
          <input
            autoFocus
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder="Name"
            style={{ ...input, boxSizing: "border-box" }}
          />
        </Sheet>
      )}
      {open === "__overflow" && overflow && (
        <Sheet title={overflow.title} onClose={() => setOpen(null)}>
          <div style={{ fontFamily: body, fontSize: 13.5, color: FEED_TEXT_MID, lineHeight: 1.55 }}>{overflow.content}</div>
        </Sheet>
      )}
    </>
  );
}
