import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Set up your account" };

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[15px] font-bold text-white">
            G
          </span>
          <span className="text-lg font-semibold tracking-[-0.01em]">Go3net Office</span>
        </div>
        <Suspense>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
