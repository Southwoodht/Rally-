"use client";
import React, { useState } from "react";
import { Achievements, type Achievement } from "@/components/profile/Achievements";
import { BestWins, type BestWin } from "@/components/profile/BestWins";
import { GapInsight, PlayingStyle, type GapInsightProps, type PlayingStyleProps } from "@/components/profile/GapInsight";
import { onSide } from "@/core/trophyTimeline";
import { MatchHistoryList, PointsSummary, type MatchHistoryItem } from "@/components/profile/MatchHistoryList";
import { recordsByYear } from "@/core/yearRecord";
import { OpponentRecords, type OpponentRecord } from "@/components/profile/OpponentRecords";
import { ProfileActions, type ProfileActionsProps } from "@/components/profile/ProfileActions";
import { ProfileHeader, type ProfileHeaderProps } from "@/components/profile/ProfileHeader";
import { RecordCard, type OutcomeFilter, type RecordCardProps } from "@/components/profile/RecordCard";
import { RivalsCard, type RivalsCardData } from "@/components/profile/RivalsCard";
import { Rivalries, type RivalryCardProps } from "@/components/profile/RivalryCard";
import { SettingsList, VerifiedTrophiesRow, type ProfileTrophy, type SettingsRow } from "@/components/profile/ProfileRows";
import { ChevronRight, Share } from "lucide-react";
import { fullNameOf } from "@/lib/format";
import { utrLabel } from "@/core/utr";
import { shareProfileCard } from "@/lib/shareCard";
import { FilterChips, type FilterDef } from "@/components/table/FilterChips";
import { FEED_LIME, FEED_RAISED, FEED_TEXT_HI, FEED_TEXT_MID, body } from "@/lib/theme";

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
  opponents?: { lead: OpponentRecord[]; behind: OpponentRecord[]; level?: number } | null;
  rivalsCard?: RivalsCardData | null;
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
const OPPONENTS_PREVIEW = 4;

export function ProfileView(p: ProfileViewProps) {
  const isSelf = p.viewer === "self";
  // Expansion is view state, not data: the container already handed over
  // every row, and how many of them are on screen is nobody else's business.
  const [allOpponents, setAllOpponents] = useState(false);
  const [allHistory, setAllHistory] = useState(false);
  // Tapping "28 won" asks a question of the list below, so the answer goes
  // there rather than opening a second list somewhere else.
  const [filter, setFilter] = useState<OutcomeFilter>(null);
  const history = p.history || [];
  const filtered = filter ? history.filter((m) => m.outcome === filter && !m.legacy) : [];
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
  const FILTER_TITLE = { W: "Wins", D: "Draws", L: "Losses" } as const;
  // Editing belongs to the owner of the result, wherever the list appears.
  const forViewer = (list: MatchHistoryItem[]) =>
    isSelf ? list : list.map((m) => ({ ...m, onEdit: undefined }));

  return (
    <div>
      <ProfileHeader {...p.header} viewer={p.viewer} />

      {/* Directly under the header, because the reason you are on somebody
          else's profile is usually that you want to talk to them. */}
      {!isSelf && p.actions && <ProfileActions {...p.actions} />}

      {p.period && (
        <div style={{ marginTop: 18 }}>
          <FilterChips filters={[p.period]} />
        </div>
      )}

      <RecordCard {...p.record} onFilter={setFilter} activeFilter={filter} />
      {p.rivalsCard && p.opponents && (p.opponents.lead.length > 0 || p.opponents.behind.length > 0) && (
        <RivalsCard data={p.rivalsCard} lead={p.opponents.lead.length} behind={p.opponents.behind.length} self={isSelf} />
      )}
      <ShareCardButton p={p} isSelf={isSelf} />

      {filter && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13, color: FEED_TEXT_HI }}>
              {FILTER_TITLE[filter]} · {filtered.length}
            </span>
            <Link label="Close" onClick={() => setFilter(null)} arrow={false} />
          </div>
          <MatchHistoryList items={forViewer(filtered)} />
        </div>
      )}

      {p.gap && <div style={{ marginTop: 12 }}><GapInsight {...p.gap} /></div>}

      {/* Directly under the record, because it is the same fact over time and
          the number above it is where the line ends. */}
      {p.ratingLine && <div style={{ marginTop: 12 }}>{p.ratingLine}</div>}

      {p.playingStyle && (
        <Section title="Playing style"><PlayingStyle {...p.playingStyle} /></Section>
      )}

      {/* Above Rivalries: who somebody knows places them, and a rivalry only
          means something once you know who they are. */}
      {p.friends}

      {p.rivalries && p.rivalries.length > 0 && (
        <Section title="Rivalries"><Rivalries items={p.rivalries} /></Section>
      )}

      {p.bestWins && p.bestWins.length > 0 && (
        <Section title="Best wins"><BestWins wins={p.bestWins} onOpenMatch={p.onOpenMatch} /></Section>
      )}

      {p.opponents && (p.opponents.lead.length > 0 || p.opponents.behind.length > 0) && (
        <Section
          title="Head to head"
          right={
            allOpponents
              ? <Link label="Show fewer" onClick={() => setAllOpponents(false)} arrow={false} />
              : <Link label={`All ${p.opponents.lead.length + p.opponents.behind.length}`} onClick={() => setAllOpponents(true)} />
          }
        >
          <OpponentRecords
            lead={p.opponents.lead}
            behind={p.opponents.behind}
            level={p.opponents.level}
            self={isSelf}
            visible={allOpponents ? Number.MAX_SAFE_INTEGER : OPPONENTS_PREVIEW}
            onOpen={p.onOpenPlayer}
            onAll={() => setAllOpponents(true)}
          />
        </Section>
      )}

      {p.achievements && p.achievements.length > 0 && (
        <div style={{ marginTop: 22 }}><Achievements items={p.achievements} /></div>
      )}

      {p.trophies && (
        <Section title="Verified trophies">
          <VerifiedTrophiesRow trophies={p.trophies.list} onClaim={isSelf ? p.trophies.onClaim : undefined} onGive={p.trophies.onGive} onRemove={p.trophies.onRemove} />
        </Section>
      )}

      {history.length > 0 && (
        <Section
          title="Match history"
          right={
            allHistory
              ? <Link label="Show fewer" onClick={() => setAllHistory(false)} arrow={false} />
              : history.length > HISTORY_PREVIEW
                ? <Link label={`All ${p.historyTotal ?? history.length}`} onClick={() => setAllHistory(true)} />
                : undefined
          }
        >
          {/* Editing is an action on your own result, so it does not travel
              with the list when somebody else is reading it. */}
          <MatchHistoryList items={forViewer(shownHistory)} years={years} trophies={historyTrophies} />
          {p.pointsSummary && <PointsSummary {...p.pointsSummary} />}
          {/* The graded version is a different question — how good were these
              results, not what were they — so it is a separate destination
              rather than what "All 44" now means. */}
          {p.onAllHistory && (
            <button
              onClick={p.onAllHistory}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", padding: "12px 0 0", cursor: "pointer", fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_LIME }}
            >
              Every match, graded <ChevronRight size={14} strokeWidth={2} />
            </button>
          )}
        </Section>
      )}

      {isSelf && p.settings && p.settings.length > 0 && (
        <Section title="Settings"><SettingsList rows={p.settings} /></Section>
      )}
    </div>
  );
}

/**
 * Share card (lib/shareCard.ts): this profile as one picture, from exactly
 * what the screen above shows.
 */
function ShareCardButton({ p, isSelf }: { p: ProfileViewProps; isSelf: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const player = p.header.player;
  const go = async () => {
    if (busy) return;
    setBusy(true); setNote("");
    try {
      const level = [p.header.levelLabel, player?.utr != null ? utrLabel(player.utr) : null].filter(Boolean).join(" · ");
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
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={go} disabled={busy} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: FEED_RAISED, color: FEED_TEXT_HI, border: "none", borderRadius: 14, padding: "12px", fontFamily: body, fontWeight: 600, fontSize: 14.5, cursor: "pointer", opacity: busy ? 0.55 : 1 }}>
        <Share size={16} strokeWidth={2} />{busy ? "Making the card…" : isSelf ? "Share my card" : "Share their card"}
      </button>
      {note && <div style={{ fontFamily: body, fontSize: 12.5, color: FEED_TEXT_MID, marginTop: 6, textAlign: "center" }}>{note}</div>}
    </div>
  );
}
