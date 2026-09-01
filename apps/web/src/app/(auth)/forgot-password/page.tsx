import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[15px] font-bold text-white">G</span>
          <span className="text-lg font-semibold tracking-[-0.01em]">Go3net Office</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter your work email and we’ll send a reset link.</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
