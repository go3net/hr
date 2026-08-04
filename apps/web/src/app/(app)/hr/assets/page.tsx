import type { Metadata } from "next";
import { AssetsClient } from "./assets-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Company assets" };

export default function AssetsPage() {
  return (
    <RequirePermission permission="hr.assets.manage">
      <AssetsClient />
    </RequirePermission>
  );
}
