import type { Metadata } from "next";
import { PayrollClient } from "./payroll-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollPage() {
  return (
    <RequirePermission permission="hr.payroll.view">
      <PayrollClient />
    </RequirePermission>
  );
}
