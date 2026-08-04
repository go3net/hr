import type { Metadata } from "next";
import { OnboardingClient } from "./onboarding-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Onboarding & exits" };

export default function OnboardingPage() {
  return (
    <RequirePermission permission="hr.employees.manage">
      <OnboardingClient />
    </RequirePermission>
  );
}
