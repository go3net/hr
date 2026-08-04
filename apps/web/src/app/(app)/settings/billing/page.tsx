import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingClient } from "./billing-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <RequirePermission permission="settings.billing.manage">
      <Suspense>
        <BillingClient />
      </Suspense>
    </RequirePermission>
  );
}
