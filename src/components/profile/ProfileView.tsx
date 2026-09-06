"use client";
import React from "react";
import { Achievements, type Achievement } from "@/components/profile/Achievements";
import { BestWins, type BestWin } from "@/components/profile/BestWins";
import { GapInsight, PlayingStyle, type GapInsightProps, type PlayingStyleProps } from "@/components/profile/GapInsight";
import { MatchHistoryList, type MatchHistoryItem } from "@/components/profile/MatchHistoryList";
import { OpponentRecords, type OpponentRecord } from "@/components/profile/OpponentRecords";
import { ProfileHeader, type ProfileHeaderProps } from "@/components/profile/ProfileHeader";
import { RecordCard, type RecordCardProps } from "@/components/profile/RecordCard";
import { Rivalries, type RivalryCardProps } from "@/components/profile/RivalryCard";
import { SettingsList, VerifiedTrophiesRow, type SettingsRow } from "@/components/profile/ProfileRows";
import { FilterChips, type FilterDef } from "@/components/table/FilterChips";
import { FEED_LIME, FEED_TEXT_HI, body } from "@/lib/theme";

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
  rivalries?: RivalryCardProps[];
  bestWins?: BestWin[];
  opponents?: { lead: OpponentRecord[]; behind: OpponentRecord[] } | null;
  achievements?: Achievement[];
  trophies?: { count: number; onClaim?: () => void } | null;
  history?: MatchHistoryItem[];
  historyTotal?: number;
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
        <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_HI }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

const Link = ({ label, onClick }: { label: string; onClick?: () => void }) =>
  onClick ? (
    <button onClick={onClick} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 400, fontSize: 13 }}>
      {label} ›
    </button>
  ) : null;

export function ProfileView(p: ProfileViewProps) {
  const isSelf = p.viewer === "self";

  return (
    <div>
      <ProfileHeader {...p.header} viewer={p.viewer} />

      {p.period && (
        <div style={{ marginTop: 18 }}>
          <FilterChips filters={[p.period]} />
        </div>
      )}

      <RecordCard {...p.record} />

      {p.gap && <div style={{ marginTop: 12 }}><GapInsight {...p.gap} /></div>}

      {p.playingStyle && (
        <Section title="Playing style"><PlayingStyle {...p.playingStyle} /></Section>
      )}

      {p.rivalries && p.rivalries.length > 0 && (
        <Section title="Rivalries"><Rivalries items={p.rivalries} /></Section>
      )}

      {p.bestWins && p.bestWins.length > 0 && (
        <Section title="Best wins"><BestWins wins={p.bestWins} onOpenMatch={p.onOpenMatch} /></Section>
      )}

      {p.opponents && (p.opponents.lead.length > 0 || p.opponents.behind.length > 0) && (
        <Section
          title="Head to head"
          right={<Link label={`All ${p.opponents.lead.length + p.opponents.behind.length}`} onClick={p.onAllOpponents} />}
        >
          <OpponentRecords lead={p.opponents.lead} behind={p.opponents.behind} onOpen={p.onOpenPlayer} onAll={p.onAllOpponents} />
        </Section>
      )}

      {p.achievements && p.achievements.length > 0 && (
        <div style={{ marginTop: 22 }}><Achievements items={p.achievements} /></div>
      )}

      {p.trophies && (
        <Section title="Verified trophies">
          <VerifiedTrophiesRow count={p.trophies.count} onClaim={isSelf ? p.trophies.onClaim : undefined} />
        </Section>
      )}

      {p.history && p.history.length > 0 && (
        <Section
          title="Match history"
          right={<Link label={`All ${p.historyTotal ?? p.history.length}`} onClick={p.onAllHistory} />}
        >
          {/* Editing is an action on your own result, so it does not travel
              with the list when somebody else is reading it. */}
          <MatchHistoryList items={isSelf ? p.history : p.history.map((m) => ({ ...m, onEdit: undefined }))} />
        </Section>
      )}

      {isSelf && p.settings && p.settings.length > 0 && (
        <Section title="Settings"><SettingsList rows={p.settings} /></Section>
      )}
    </div>
  );
}
