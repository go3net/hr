import type { Metadata } from "next";
import { PositionsClient } from "./positions-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Positions" };

export default function PositionsPage() {
  return (
    <RequirePermission permission="hr.departments.manage">
      <PositionsClient />
    </RequirePermission>
  );
}
