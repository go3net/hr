import type { Metadata } from "next";
import { Suspense } from "react";
import { PlatformClient } from "./platform-client";
import { RequirePlatformOwner } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Platform console" };

export default function PlatformPage() {
  return (
    <RequirePlatformOwner>
      <Suspense>
        <PlatformClient />
      </Suspense>
    </RequirePlatformOwner>
  );
}
