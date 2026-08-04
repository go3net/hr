import type { Metadata } from "next";
import { CrmClient } from "./crm-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "CRM" };

export default function CrmPage() {
  return (
    <RequirePermission permission="crm.view">
      <CrmClient />
    </RequirePermission>
  );
}
