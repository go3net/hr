import type { Metadata } from "next";
import { TeamClient } from "./team-client";

export const metadata: Metadata = { title: "My team" };

export default function TeamPage() {
  return <TeamClient />;
}
