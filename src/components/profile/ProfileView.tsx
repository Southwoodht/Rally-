"use client";
import React, { useState } from "react";
import { Achievements, type Achievement } from "@/components/profile/Achievements";
import { BestWins, type BestWin } from "@/components/profile/BestWins";
import { GapInsight, PlayingStyle, type GapInsightProps, type PlayingStyleProps } from "@/components/profile/GapInsight";
import { onSide } from "@/core/trophyTimeline";
import { MatchHistoryList, PointsSummary, type MatchHistoryItem } from "@/components/profile/MatchHistoryList";
import { recordsByYear } from "@/core/yearRecord";
import type { OpponentRecord } from "@/components/profile/OpponentRecords";
import { ProfileActions, type ProfileActionsProps } from "@/components/profile/ProfileActions";
import { ProfileHeader, type ProfileHeaderProps } from "@/components/profile/ProfileHeader";
import type { RecordCardProps } from "@/components/profile/RecordCard";
import { HeadToHeadHero, HeadToHeadLists, HeadToHeadSheet, type H2HGroup, type Standing } from "@/components/profile/HeadToHeadRecord";
import { Rivalries, type RivalryCardProps } from "@/components/profile/RivalryCard";
import { SettingsList, VerifiedTrophiesRow, type ProfileTrophy, type SettingsRow } from "@/components/profile/ProfileRows";
import { ChevronRight, Share } from "lucide-react";
import { fullNameOf } from "@/lib/format";
import { utrLabel } from "@/core/utr";
import { shareProfileCard } from "@/lib/shareCard";
import { FilterChips, type FilterDef } from "@/components/table/FilterChips";
import { FEED_CARD, FEED_LIME, FEED_LOST, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, FORM_LOSS, FORM_WIN, body, display, tabular } from "@/lib/theme";
import { levelNow } from "@/core/levels";

// The whole profile, in one order, taking finished props.
//
// viewer is the only thing that changes the shape of the page, and it is
// built in from the start rather than bolted on: retrofitting "somebody
// else is reading this" onto a screen written for its owner means auditing
// every section for the assumption, and the assumptions are invisible until
// they are wrong.

export interface ProfileViewProps {
  viewer: "self" | "other";
  header: ProfileHeaderProps;
  /** All time / a year / the season, matching the Table's chips. */
  period?: FilterDef;
  record: RecordCardProps;
  /** On your own profile, the gap to the player above. On somebody else's,
   *  your head-to-head against them — the same slot answering the question
   *  you actually have about the person you are looking at. */
  gap?: GapInsightProps | null;
  /** Somebody else's profile: your record against them, for the strip. */
  versus?: { name: string; w: number; d: number; l: number; last: string | null } | null;
  playingStyle?: PlayingStyleProps | null;
  /** The career line. A node rather than props, because it is one self-
   *  contained card and threading its four maps through here would put the
   *  whole ratings engine in a presentational component's signature. */
  ratingLine?: React.ReactNode;
  /** Message and Add friend. Only meaningful on somebody else's profile. */
  actions?: ProfileActionsProps | null;
  /** The Friends card, self-contained: it does its own fetch and renders
   *  nothing at all until schema_public_friends.sql is run. A node rather
   *  than props for the same reason ratingLine is one. */
  friends?: React.ReactNode;
  rivalries?: RivalryCardProps[];
  bestWins?: BestWin[];
  opponents?: { lead: OpponentRecord[]; behind: OpponentRecord[]; level?: number; levelList?: OpponentRecord[] } | null;
  /** The hero's small row: club place and rating. */
  standing?: Standing | null;
  /** Open the head-to-head with this opponent. */
  onOpenH2H?: (opponentId: string) => void;
  achievements?: Achievement[];
  trophies?: { list: ProfileTrophy[]; onClaim?: () => void; onGive?: () => void; onRemove?: (id: string) => void } | null;
  history?: MatchHistoryItem[];
  historyTotal?: number;
  /** Own results + other people's = Official (core/officialTimeline.ts). */
  pointsSummary?: { own: number; others: number; total: number };
  settings?: SettingsRow[];
  onOpenPlayer?: (playerId: string) => void;
  onOpenMatch?: (matchId: string) => void;
  onAllHistory?: () => void;
  onAllOpponents?: () => void;
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_HI }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

const Link = ({ label, onClick, arrow = true }: { label: string; onClick?: () => void; arrow?: boolean }) =>
  onClick ? (
    <button onClick={onClick} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 500, fontSize: 13 }}>
      {label}{arrow ? " ›" : ""}
    </button>
  ) : null;

/** How many rows a section shows before you ask for the rest. */
const HISTORY_PREVIEW = 5;

export function ProfileView(p: ProfileViewProps) {
  const isSelf = p.viewer === "self";
  // Expansion is view state, not data: the container already handed over
  // every row, and how many of them are on screen is nobody else's business.
  const [allOpponents, setAllOpponents] = useState(false);
  const [h2hSheet, setH2hSheet] = useState<H2HGroup | null>(null);
  const [allHistory, setAllHistory] = useState(false);
  const history = p.history || [];
  const shownHistory = allHistory ? history : history.slice(0, HISTORY_PREVIEW);
  // Each year's record over the WHOLE history, so the header above a
  // five-row preview still says how the whole year went.
  const years = recordsByYear(history.filter((m) => typeof m.ts === "number").map((m) => ({ date: m.ts as number, outcome: m.outcome, pending: m.pending, legacy: m.legacy })));
  // The same trophies as the Verified trophies row, in the shape the history
  // places them by. Not in the Wins/Draws/Losses lists above: those answer
  // "which matches", and a trophy is not one.
  // This is the singles history, so only the singles side's honours — a
  // doubles trophy goes in the doubles profile's history instead.
  const historyTrophies = (p.trophies?.list || [])
    .map((t) => ({ id: t.id, competition: t.competition, result: t.result, season: t.season, won_on: t.wonOn, format: t.format, clubName: t.clubName }))
    .filter((t) => onSide(t, "singles"));
  // Editing belongs to the owner of the result, wherever the list appears.
  const forViewer = (list: MatchHistoryItem[]) =>
    isSelf ? list : list.map((m) => ({ ...m, onEdit: undefined }));

  const share = useShareCard(p);
  const total = p.historyTotal ?? history.length;

  // Sam's order, 2026-10-31 — each thing once:
  //   header + buttons · the head-to-head hero (place, rating, record, last
  //   five) · on someone else's profile, You vs them · biggest rivalries ·
  //   Behind then Ahead · best wins by person · achievements, trophies ·
  //   the rating line · All matches.
  return (
    <div>
      <ProfileHeader {...p.header} viewer={p.viewer} />
      {!isSelf && p.actions && <ProfileActions {...p.actions} onShare={share.go} />}
      {!isSelf && share.note && <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 8 }}>{share.note}</div>}

      {p.period && (
        <div style={{ marginTop: 18 }}>
          <FilterChips filters={[p.period]} />
        </div>
      )}

      <div style={{ marginTop: p.period ? 0 : 18 }}>
        <HeadToHeadHero
          ahead={p.opponents?.lead.length || 0} level={p.opponents?.levelList?.length || 0} behind={p.opponents?.behind.length || 0}
          self={isSelf} record={p.record.record} standing={p.standing}
          form={p.record.form}
          rates={{ winRate: p.record.winRate, unbeatenRate: p.record.unbeatenRate, currentStreak: p.record.currentStreak, bestStreak: p.record.bestStreak }}
          onShow={setH2hSheet}
        />
      </div>
      {h2hSheet && p.opponents && (
        <HeadToHeadSheet
          group={h2hSheet} lead={p.opponents.lead} behind={p.opponents.behind} level={p.opponents.levelList || []} self={isSelf}
          onClose={() => setH2hSheet(null)} onOpen={p.onOpenH2H || p.onOpenPlayer}
        />
      )}

      {!isSelf && p.versus && <VersusStrip {...p.versus} />}

      {p.rivalries && p.rivalries.length > 0 && (
        <Section title="Biggest rivalries"><Rivalries items={p.rivalries.slice(0, 2)} self={isSelf} /></Section>
      )}

      {p.opponents && (
        <HeadToHeadLists
          lead={p.opponents.lead} behind={p.opponents.behind} level={p.opponents.levelList || []} self={isSelf}
          showAllAhead={allOpponents} onAllAhead={() => setAllOpponents(true)}
          onOpen={p.onOpenH2H || p.onOpenPlayer}
        />
      )}

      {p.bestWins && p.bestWins.length > 0 && (
        <Section title="Best wins"><BestWins wins={p.bestWins} onOpenMatch={p.onOpenMatch} /></Section>
      )}

      {p.achievements && p.achievements.length > 0 && (
        <div style={{ marginTop: 22 }}><Achievements items={p.achievements} /></div>
      )}

      {p.trophies && (
        <Section title="Verified trophies">
          <VerifiedTrophiesRow trophies={p.trophies.list} onClaim={isSelf ? p.trophies.onClaim : undefined} onGive={p.trophies.onGive} onRemove={p.trophies.onRemove} />
        </Section>
      )}

      {p.ratingLine && <div style={{ marginTop: 22 }}>{p.ratingLine}</div>}

      {/* One row for the whole history (Sam: "All matches · N ›"). It opens
          Your matches; where that screen isn't on offer (a profile read from
          outside the club), the list opens here instead. */}
      {total > 0 && (
        <button
          onClick={p.onAllHistory || (() => setAllHistory(!allHistory))}
          style={{ display: "flex", alignItems: "center", width: "100%", marginTop: 22, background: FEED_CARD, border: "none", borderRadius: 14, padding: "15px 16px", cursor: "pointer", fontFamily: body, fontWeight: 600, fontSize: 15.5, color: FEED_TEXT_HI, textAlign: "left" }}
        >
          <span style={{ flex: 1, ...tabular }}>All matches · {total}</span>
          <ChevronRight size={18} strokeWidth={2} color={FEED_TEXT_MID} style={{ transform: !p.onAllHistory && allHistory ? "rotate(90deg)" : undefined }} />
        </button>
      )}
      {!p.onAllHistory && allHistory && (
        <div style={{ marginTop: 10 }}>
          <MatchHistoryList items={forViewer(history)} years={years} trophies={historyTrophies} />
        </div>
      )}

      {isSelf && (
        <div style={{ marginTop: 12 }}>
          <button onClick={share.go} disabled={share.busy} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 14, padding: "12px", fontFamily: body, fontWeight: 600, fontSize: 14.5, cursor: "pointer", opacity: share.busy ? 0.55 : 1 }}>
            <Share size={16} strokeWidth={2} />{share.busy ? "Making the card…" : "Share my card"}
          </button>
          {share.note && <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 6, textAlign: "center" }}>{share.note}</div>}
        </div>
      )}

      {isSelf && p.settings && p.settings.length > 0 && (
        <Section title="Settings"><SettingsList rows={p.settings} /></Section>
      )}
    </div>
  );
}

/** "You vs Charlie": your record against them, who leads, how many and
 *  when last (Sam, 2026-10-31). Replaces the "You lead X" card. */
function VersusStrip({ name, w, d, l, last }: { name: string; w: number; d: number; l: number; last: string | null }) {
  const n = w + d + l;
  const lead = w > l ? "You lead" : l > w ? name + " leads" : "Level";
  const colour = w > l ? FORM_WIN : l > w ? FORM_LOSS : FEED_TEXT_MID;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, background: FEED_CARD, borderRadius: 14, padding: "12px 16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: body, fontWeight: 600, fontSize: 14.5, color: FEED_TEXT_HI, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>You vs {name}</div>
        <div style={{ ...tabular, fontFamily: body, fontWeight: 500, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: colour, fontWeight: 600 }}>{lead}</span> · {n} played{last ? " · last " + last : ""}
        </div>
      </div>
      <span style={{ ...tabular, fontFamily: display, fontWeight: 700, fontSize: 24, color: FEED_TEXT_HI, flexShrink: 0 }}>{w}–{d}–{l}</span>
    </div>
  );
}

/**
 * Share card (lib/shareCard.ts): this profile as one picture, from exactly
 * what the screen above shows. A hook now, because the button lives in two
 * places: at the foot of your own profile, and in the ⋯ menu on anyone
 * else's.
 */
function useShareCard(p: ProfileViewProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const player = p.header.player;
  const go = async () => {
    if (busy) return;
    setBusy(true); setNote("");
    try {
      const level = [levelNowLabel(player), player?.utr != null ? utrLabel(player.utr) : null].filter(Boolean).join(" · ");
      const r = await shareProfileCard({
        name: fullNameOf(player) || "Player",
        photo: player?.avatarUrl || null,
        club: p.header.leagueName || "",
        level: level || null,
        record: p.record.record,
        winRate: p.record.winRate,
        unbeatenRate: p.record.unbeatenRate ?? null,
        rankings: (p.record.rankings || []).map((x) => ({ label: x.label, value: x.value })),
        form: (p.record.form || []).map((f) => f.outcome),
        beats: [...(p.opponents?.lead || [])].sort((a, b) => b.w - a.w || a.l - b.l)
          .map((o) => ({ name: fullNameOf(o.player) || "Somebody", w: o.w, d: o.d, l: o.l, legacy: o.legacy || 0 })),
        losesTo: [...(p.opponents?.behind || [])].sort((a, b) => b.l - a.l || a.w - b.w)
          .map((o) => ({ name: fullNameOf(o.player) || "Somebody", w: o.w, d: o.d, l: o.l, legacy: o.legacy || 0 })),
        trophies: (p.trophies?.list || []).map((t) => [t.competition, t.result, t.season].filter(Boolean).join(" · ")),
        achievements: { done: (p.achievements || []).filter((a) => a.earned).map((a) => a.label), total: (p.achievements || []).length },
      });
      if (r === "saved") setNote("Saved as a picture. Find it in your downloads to share.");
    } catch (e: any) {
      setNote(e?.message || "Couldn't make the card.");
    }
    setBusy(false);
  };
  return { go, busy, note };
}

function levelNowLabel(player: any): string | null {
  const lv = levelNow(player);
  return lv ? lv.cat + " · " + lv.sub : null;
}
