"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(token && email ? null : "This password-reset link is incomplete or invalid.");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Use at least 10 characters, including letters and numbers.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords don’t match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password, password_confirmation: confirmation }),
    }).catch(() => null);
    const json = await response?.json().catch(() => null);
    setSubmitting(false);

    if (!response?.ok) {
      const fieldError = json?.errors ? (Object.values(json.errors)[0] as string[])?.[0] : undefined;
      setError(json?.error?.message ?? fieldError ?? "Could not reset your password. Request a new link and try again.");
      return;
    }
    router.replace("/login?password_reset=1");
  };

  return (
    <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
      {error && <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">{error}</div>}
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" disabled={!token || !email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password-confirmation">Confirm new password</Label>
        <Input id="password-confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={!token || !email} />
      </div>
      <Button className="w-full" size="lg" type="submit" disabled={submitting || !token || !email || !password || !confirmation}>
        {submitting && <Loader2 className="animate-spin" />} Reset password
      </Button>
      <Link className="block text-center text-[13px] text-muted-foreground hover:text-foreground" href="/login">Back to sign in</Link>
    </form>
  );
}
