"use client";
import React, { useState } from "react";
import { Achievements, type Achievement } from "@/components/profile/Achievements";
import { BestWins, type BestWin } from "@/components/profile/BestWins";
import { GapInsight, PlayingStyle, type GapInsightProps, type PlayingStyleProps } from "@/components/profile/GapInsight";
import { MatchHistoryList, type MatchHistoryItem } from "@/components/profile/MatchHistoryList";
import { OpponentRecords, type OpponentRecord } from "@/components/profile/OpponentRecords";
import { ProfileActions, type ProfileActionsProps } from "@/components/profile/ProfileActions";
import { ProfileHeader, type ProfileHeaderProps } from "@/components/profile/ProfileHeader";
import { RecordCard, type OutcomeFilter, type RecordCardProps } from "@/components/profile/RecordCard";
import { Rivalries, type RivalryCardProps } from "@/components/profile/RivalryCard";
import { SettingsList, VerifiedTrophiesRow, type ProfileTrophy, type SettingsRow } from "@/components/profile/ProfileRows";
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
  /** Message and Add friend. Only meaningful on somebody else's profile. */
  actions?: ProfileActionsProps | null;
  rivalries?: RivalryCardProps[];
  bestWins?: BestWin[];
  opponents?: { lead: OpponentRecord[]; behind: OpponentRecord[] } | null;
  achievements?: Achievement[];
  trophies?: { list: ProfileTrophy[]; onClaim?: () => void } | null;
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

const Link = ({ label, onClick, arrow = true }: { label: string; onClick?: () => void; arrow?: boolean }) =>
  onClick ? (
    <button onClick={onClick} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: FEED_LIME, fontFamily: body, fontWeight: 400, fontSize: 13 }}>
      {label}{arrow ? " ›" : ""}
    </button>
  ) : null;

/** How many rows a section shows before you ask for the rest.
 *
 *  History is four because it is a preview of "Your matches" rather than a
 *  list in its own right — the full one lives on that screen, graded, and
 *  two versions of the same list is one to keep in step. */
const HISTORY_PREVIEW = 4;
const OPPONENTS_PREVIEW = 4;

export function ProfileView(p: ProfileViewProps) {
  const isSelf = p.viewer === "self";
  // Expansion is view state, not data: the container already handed over
  // every row, and how many of them are on screen is nobody else's business.
  const [allOpponents, setAllOpponents] = useState(false);
  // Tapping "28 won" asks a question of the list below, so the answer goes
  // there rather than opening a second list somewhere else.
  const [filter, setFilter] = useState<OutcomeFilter>(null);
  const history = p.history || [];
  const filtered = filter ? history.filter((m) => m.outcome === filter) : [];
  const shownHistory = history.slice(0, HISTORY_PREVIEW);
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

      {filter && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: body, fontWeight: 500, fontSize: 13, color: FEED_TEXT_HI }}>
              {FILTER_TITLE[filter]} · {filtered.length}
            </span>
            <Link label="Close" onClick={() => setFilter(null)} arrow={false} />
          </div>
          <MatchHistoryList items={forViewer(filtered)} />
        </div>
      )}

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
          right={
            allOpponents
              ? <Link label="Show fewer" onClick={() => setAllOpponents(false)} arrow={false} />
              : <Link label={`All ${p.opponents.lead.length + p.opponents.behind.length}`} onClick={() => setAllOpponents(true)} />
          }
        >
          <OpponentRecords
            lead={p.opponents.lead}
            behind={p.opponents.behind}
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
          <VerifiedTrophiesRow trophies={p.trophies.list} onClaim={isSelf ? p.trophies.onClaim : undefined} />
        </Section>
      )}

      {history.length > 0 && (
        <Section
          title="Match history"
          right={<Link label={`All ${p.historyTotal ?? history.length}`} onClick={p.onAllHistory} />}
        >
          {/* Editing is an action on your own result, so it does not travel
              with the list when somebody else is reading it. */}
          <MatchHistoryList items={forViewer(shownHistory)} />
        </Section>
      )}

      {isSelf && p.settings && p.settings.length > 0 && (
        <Section title="Settings"><SettingsList rows={p.settings} /></Section>
      )}
    </div>
  );
}
