"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Invite = { name: string; email: string };

export function AcceptInviteForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [invite, setInvite] = useState<Invite | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">(() =>
    token ? "loading" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/auth/invitation?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState("invalid");
          return;
        }
        const json = await res.json();
        setInvite(json.data);
        setState("ready");
      })
      .catch(() => !cancelled && setState("invalid"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Your password needs at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, password_confirmation: confirm }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? "Could not set up your account.");
        setBusy(false);
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Something went wrong — try again.");
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking your invitation…
      </p>
    );
  }

  if (state === "invalid") {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Invitation not valid</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This link is invalid or has expired. Ask your administrator to send a new invitation.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Welcome, {invite?.name?.split(" ")[0]} 👋</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose a password for <span className="font-medium text-foreground">{invite?.email}</span> to
        activate your account.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="ai-password">Password</Label>
          <Input
            id="ai-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 10 characters"
            autoComplete="new-password"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-confirm">Confirm password</Label>
          <Input
            id="ai-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {/* The button stays enabled and explains itself: a greyed-out button
            with no reason reads as a broken page, especially on a phone
            where the placeholder disappears as soon as you start typing. */}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
          Activate my account
        </Button>
        <p className="text-[13px] text-muted-foreground">
          Your password needs at least 10 characters.
        </p>
      </form>
    </div>
  );
}
