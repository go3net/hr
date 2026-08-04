import type { Metadata } from "next";
import { RecruitmentClient } from "./recruitment-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Recruitment" };

export default function RecruitmentPage() {
  return (
    <RequirePermission permission="hr.recruitment.manage">
      <RecruitmentClient />
    </RequirePermission>
  );
}
