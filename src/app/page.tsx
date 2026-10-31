import type { Metadata } from "next";
import AuthGate from "@/components/auth/AuthGate";

// The front page is the public landing page for anyone signed out (see
// components/landing/Landing.tsx), so it is the one URL that names itself
// canonical. Title, description and share image come from layout.tsx.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <AuthGate />;
}
