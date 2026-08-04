import type { Metadata } from "next";
import { RolesClient } from "./roles-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Roles & members" };

export default function RolesPage() {
  return (
    <RequirePermission permission="settings.roles.manage">
      <RolesClient />
    </RequirePermission>
  );
}
