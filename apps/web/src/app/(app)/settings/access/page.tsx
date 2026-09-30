import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessClient } from "./access-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Staff access" };

export default function AccessPage() {
  return (
    <RequirePermission permission="hr.employees.manage">
      <Suspense>
        <AccessClient />
      </Suspense>
    </RequirePermission>
  );
}
