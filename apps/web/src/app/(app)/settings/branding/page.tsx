import type { Metadata } from "next";
import { BrandingClient } from "./branding-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Branding" };

export default function BrandingPage() {
  return (
    <RequirePermission permission="settings.branding.manage">
      <BrandingClient />
    </RequirePermission>
  );
}
