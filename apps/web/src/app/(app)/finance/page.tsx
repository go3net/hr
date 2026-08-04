import type { Metadata } from "next";
import { FinanceClient } from "./finance-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <RequirePermission permission="finance.view">
      <FinanceClient />
    </RequirePermission>
  );
}
