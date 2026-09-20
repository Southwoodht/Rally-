"use client";
import React from "react";
import { AwaitingResult, ResultPrompt } from "@/components/home/ResultPrompt";
import { HomeHeader, type HomeHeaderProps } from "@/components/home/HomeHeader";
import { HomeTiles, type NextUp, type PeriodStat } from "@/components/home/HomeTiles";
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
  nextUp?: NextUp | null;
  periods?: PeriodStat[] | null;
  awaitingResult?: AwaitingResult[];
  onResolveFixture?: (fixtureId: string, winner: "p1" | "p2" | "draw", score: string) => Promise<boolean> | void;
  onCancelFixture?: (fixtureId: string) => void;
  levelRecheck?: React.ReactNode;
  whatsNew?: React.ReactNode;
  onBook?: () => void;
  /** The newsfeed. */
  children?: React.ReactNode;
}

export function Home({
  header, standing, nextUp, periods, awaitingResult, levelRecheck, whatsNew,
  onBook, onResolveFixture, onCancelFixture, children,
}: HomeProps) {
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

      {/* A result waiting to be agreed used to have a card up here as well as
          a row in "Awaiting confirmation" in the feed below, which is the same
          result twice on one screen — and the top copy is the one Sam called
          messy. It is one place now, in the feed, and the nudge went down
          there with it rather than being lost with the card that carried it. */}

      <div style={{ marginBottom: 18 }}>
        <HomeTiles nextUp={nextUp} periods={periods} onBook={onBook} />
      </div>

      {children}
    </div>
  );
}
