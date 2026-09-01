import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[15px] font-bold text-white">G</span>
          <span className="text-lg font-semibold tracking-[-0.01em]">Go3net Office</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Use at least 10 characters, including letters and numbers.</p>
        <Suspense><ResetPasswordForm /></Suspense>
      </div>
    </div>
  );
}
