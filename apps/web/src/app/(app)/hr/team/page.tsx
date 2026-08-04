import type { Metadata } from "next";
import { TeamClient } from "./team-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "My team" };

export default function TeamPage() {
  return (
    <RequirePermission permission="hr.team.view">
      <TeamClient />
    </RequirePermission>
  );
}
