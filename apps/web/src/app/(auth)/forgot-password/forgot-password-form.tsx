"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const json = await response?.json().catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      setError(json?.error?.message ?? "Could not request a reset link. Try again.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="mt-8 space-y-5">
        <div className="rounded-[10px] border border-primary/25 bg-primary/8 px-3 py-3 text-[13px]">
          If an account matches that email address, a password-reset link has been sent. Check your inbox and spam folder.
        </div>
        <Link className="block text-center text-[13px] text-primary hover:underline" href="/login">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
      {error && <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">{error}</div>}
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus />
      </div>
      <Button className="w-full" size="lg" type="submit" disabled={submitting || !email}>
        {submitting && <Loader2 className="animate-spin" />} Send reset link
      </Button>
      <Link className="block text-center text-[13px] text-muted-foreground hover:text-foreground" href="/login">Back to sign in</Link>
    </form>
  );
}
