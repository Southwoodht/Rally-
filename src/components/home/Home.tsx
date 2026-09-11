"use client";
import React from "react";
import { AwaitingResult, ResultPrompt } from "@/components/home/ResultPrompt";
import { HomeHeader, type HomeHeaderProps } from "@/components/home/HomeHeader";
import { HomeTiles, type NextUp, type ThisMonth } from "@/components/home/HomeTiles";
import { PendingStack, type PendingConfirmation } from "@/components/home/PendingConfirmationCard";
import { StandingHero, type StandingHeroProps } from "@/components/home/StandingHero";

// The home screen: a dashboard with the newsfeed running on underneath it.
//
// The feed comes in as children rather than being rendered here, and that is
// the whole point of the arrangement — one scroll container, so the dashboard
// scrolls away and the feed keeps going. Not a panel with a "see all" link
// under it, which would make the feed somewhere you go rather than something
// you are already reading.
//
// Presentational throughout. Every number arrives finished; nothing in this
// tree counts, ranks or fetches anything.

export interface HomeProps {
  header: HomeHeaderProps;
  /** Null when this player has no place yet — no games, or not in the table.
   *  The hero is the screen's answer to "where am I", so with no answer it
   *  is left out rather than shown holding zeros. */
  standing?: StandingHeroProps | null;
  pending?: PendingConfirmation[];
  nextUp?: NextUp | null;
  thisMonth?: ThisMonth | null;
  onNudge?: (matchId: string) => void;
  awaitingResult?: AwaitingResult[];
  onResolveFixture?: (fixtureId: string, winner: "p1" | "p2" | "draw", score: string) => Promise<boolean> | void;
  onCancelFixture?: (fixtureId: string) => void;
  levelRecheck?: React.ReactNode;
  whatsNew?: React.ReactNode;
  onEditMatch?: (matchId: string) => void;
  onSeeAllPending?: () => void;
  onBook?: () => void;
  /** The newsfeed. */
  children?: React.ReactNode;
}

export function Home({
  header, standing, pending, nextUp, thisMonth, awaitingResult, levelRecheck, whatsNew,
  onNudge, onEditMatch, onSeeAllPending, onBook, onResolveFixture, onCancelFixture, children,
}: HomeProps) {
  const hasPending = !!pending && pending.length > 0;
  return (
    <div>
      <HomeHeader {...header} />

      {standing && (
        <div style={{ marginBottom: 12 }}>
          <StandingHero {...standing} />
        </div>
      )}

      {whatsNew}
      {levelRecheck}

      {/* Above pending confirmations: a result nobody has entered is a
          bigger gap than one waiting to be agreed. */}
      {!!awaitingResult?.length && onResolveFixture && (
        <ResultPrompt items={awaitingResult} onResolve={onResolveFixture} onCancel={onCancelFixture} />
      )}

      {hasPending && (
        <div style={{ marginBottom: 12 }}>
          <PendingStack items={pending!} onNudge={onNudge} onEdit={onEditMatch} onSeeAll={onSeeAllPending} />
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <HomeTiles nextUp={nextUp} thisMonth={thisMonth} onBook={onBook} />
      </div>

      {children}
    </div>
  );
}
