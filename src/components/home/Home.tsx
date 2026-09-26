"use client";
import React from "react";
import { AwaitingResult, ResultPrompt } from "@/components/home/ResultPrompt";
import { HomeHeader, type HomeHeaderProps } from "@/components/home/HomeHeader";
import { HomeFocus, type HomeFocusProps } from "@/components/home/HomeFocus";
import { StandingHero, type StandingHeroProps } from "@/components/home/StandingHero";
import { RankCarousel } from "@/components/doubles/RankCarousel";
import { Reveal } from "@/components/ui/Reveal";

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
//
// The cards are staggered in on mount — see Reveal. The index is their reading
// order, not their source order, so the hero is always first however late the
// rest of the data arrives.

export interface HomeProps {
  header: HomeHeaderProps;
  /** Null when this player has no place yet — no games, or not in the table.
   *  The hero is the screen's answer to "where am I", so with no answer it
   *  is left out rather than shown holding zeros. */
  standing?: StandingHeroProps | null;
  /** Page 2 of the rank card. Absent = doubles off = no carousel at all. */
  doublesCard?: React.ReactNode;
  /** The middle block: days-since or this week's record, the summary line,
   *  and either your next match or the person just above you. */
  focus?: HomeFocusProps | null;
  awaitingResult?: AwaitingResult[];
  onResolveFixture?: (fixtureId: string, winner: "p1" | "p2" | "draw", score: string) => Promise<boolean> | void;
  onCancelFixture?: (fixtureId: string) => void;
  levelRecheck?: React.ReactNode;
  whatsNew?: React.ReactNode;
  /** The newsfeed. */
  children?: React.ReactNode;
}

export function Home({
  header, standing, doublesCard, focus, awaitingResult, levelRecheck, whatsNew,
  onResolveFixture, onCancelFixture, children,
}: HomeProps) {
  let step = 0;
  return (
    <div>
      <HomeHeader {...header} />

      {standing && (
        <Reveal index={step++} style={{ marginBottom: 12 }}>
          {/* doublesCard is the second page of the rank carousel. When it is
              absent — every league with doubles off — this is exactly what it
              was: the singles hero, alone, with no carousel around it. The
              carousel is not rendered at all rather than rendered with one
              page, so the page dots and the swipe hint cannot appear on a
              screen that has nowhere to swipe to. */}
          {doublesCard
            ? <RankCarousel>{[<StandingHero key="s" {...standing} />, doublesCard] as [React.ReactNode, React.ReactNode]}</RankCarousel>
            : <StandingHero {...standing} />}
        </Reveal>
      )}

      {whatsNew && <Reveal index={step++}>{whatsNew}</Reveal>}
      {levelRecheck && <Reveal index={step++}>{levelRecheck}</Reveal>}

      {/* Above pending confirmations: a result nobody has entered is a
          bigger gap than one waiting to be agreed. */}
      {!!awaitingResult?.length && onResolveFixture && (
        <Reveal index={step++}>
          <ResultPrompt items={awaitingResult} onResolve={onResolveFixture} onCancel={onCancelFixture} />
        </Reveal>
      )}

      {/* A result waiting to be agreed used to have a card up here as well as
          a row in "Awaiting confirmation" in the feed below, which is the same
          result twice on one screen — and the top copy is the one Sam called
          messy. It is one place now, in the feed, and the nudge went down
          there with it rather than being lost with the card that carried it. */}

      {focus && (
        <Reveal index={step++} style={{ marginBottom: 18 }}>
          <HomeFocus {...focus} />
        </Reveal>
      )}

      {children}
    </div>
  );
}
