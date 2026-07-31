import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingClient } from "./billing-client";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <Suspense>
      <BillingClient />
    </Suspense>
  );
}
