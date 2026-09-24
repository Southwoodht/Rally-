"use client";
import React from "react";
import { Trophy, Swords, Plus, Clock, User, Home as HomeIcon, CalendarDays, Settings as Gear, ChevronLeft, ChevronDown, Check } from "lucide-react";
import { BALL, FEED_DEEP, FEED_FAB, FEED_ON_FAB, LINE, MUTED, body } from "@/lib/theme";

export function BottomNav({ tab, setTab }: any) {
  // Compare has no tab of its own any more — it's reached from a Table row
  // and from a profile — so it lights Table rather than nothing at all.
  const active = (tab === "settings" || tab === "myprofile") ? "profile"
    : tab === "h2h" ? "ladder"
    : tab;
  const item = (key, Icon, label) => {
    const on = active === key;
    return (
      <button onClick={() => setTab(key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", padding: "8px 0", color: on ? BALL : MUTED }}>
        <Icon size={22} strokeWidth={2} /><span style={{ fontFamily: body, fontWeight: 600, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</span>
      </button>
    );
  };
  return (
    // §4: 84px on --bg-bar with a 1px --line top border. The bar colour is
    // FEED_DEEP, which is the darkest surface and was previously reserved for
    // ink on lime — the new token set gives the top bar and the nav their own
    // surface, and this is it.
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 84, background: FEED_DEEP, borderTop: "1px solid " + LINE, display: "flex", justifyContent: "space-around", alignItems: "center", maxWidth: 620, margin: "0 auto", boxSizing: "border-box", paddingBottom: "calc(10px + env(safe-area-inset-bottom))", zIndex: 55 }}>
      {item("home", HomeIcon, "Home")}
      {item("ladder", Trophy, "Table")}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {/* Cream, not gold. §2: the centre button is a big filled surface,
            and it is --fab rather than --hero because three of the four
            future themes give it its own colour. 60x60, raised 30 above the
            bar, per §4 and both mockups. */}
        <button onClick={() => setTab("add")} style={{ width: 60, height: 60, borderRadius: 30, background: FEED_FAB, color: FEED_ON_FAB, border: "none", display: "grid", placeItems: "center", cursor: "pointer", marginTop: -30 }}><Plus size={26} strokeWidth={2.5} /></button>
      </div>
      {item("fixtures", CalendarDays, "Fixtures")}
      {item("profile", User, "Profile")}
    </nav>
  );
}
