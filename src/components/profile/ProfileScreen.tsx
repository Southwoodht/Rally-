"use client";
import React from "react";
import { ProfileContainer } from "@/components/profile/ProfileContainer";
import { Empty } from "@/components/ui/atoms";

// Your own profile.
//
// The friends card and the linked-player explainer that used to sit above
// the record are gone: both are rows in the settings list at the foot of the
// screen now. A card and a paragraph are what you spend when something needs
// explaining, and "Linked player · Samuel Henry" does not.
export function ProfileScreen({ players, meId, shared, onSetMe, goH2H, goSettings, goEdit, goFriends }: any) {
  const me = players.find((p: any) => p.id === meId);
  if (!me) return <Empty msg="Add players in Settings first." />;
  return (
    <ProfileContainer
      {...shared}
      player={me}
      viewer="self"
      onSettings={goSettings}
      onFriends={goFriends}
      onLinkedPlayer={goEdit}
    />
  );
}
