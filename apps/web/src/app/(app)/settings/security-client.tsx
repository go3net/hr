"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { post } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useBootstrap } from "@/hooks/use-api";

type Stage =
  | { step: "idle" }
  | { step: "pending"; secret: string; otpauthUrl: string }
  | { step: "enabled"; recoveryCodes?: string[] };

export function SecurityClient() {
  const { data: session } = useBootstrap();
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const enable = () =>
    run(async () => {
      const res = await post<{ secret: string; otpauth_url: string }>("/me/two-factor/enable");
      setStage({ step: "pending", secret: res.data.secret, otpauthUrl: res.data.otpauth_url });
    });

  const confirm = () =>
    run(async () => {
      const res = await post<{ recovery_codes: string[] }>("/me/two-factor/confirm", { code });
      setStage({ step: "enabled", recoveryCodes: res.data.recovery_codes });
      setCode("");
    });

  const disable = () =>
    run(async () => {
      await post("/me/two-factor/disable", { password });
      setStage({ step: "idle" });
      setPassword("");
    });

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session?.user.email} · {session?.tenant?.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                A 6-digit code from your authenticator app is required at every sign-in.
              </CardDescription>
            </div>
            {stage.step === "enabled" ? (
              <Badge variant="success">Enabled</Badge>
            ) : (
              <Badge variant="neutral">Off</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}

          {stage.step === "idle" && (
            <Button onClick={enable} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Enable two-factor
            </Button>
          )}

          {stage.step === "pending" && (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-border bg-muted/40 p-4">
                <p className="text-[13px] font-medium">1 · Add this secret to your authenticator app</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-[8px] bg-surface px-3 py-2 font-mono text-[13px]">
                    {stage.secret}
                  </code>
                  <Button variant="outline" size="icon" onClick={() => copySecret(stage.secret)} aria-label="Copy secret">
                    {copied ? <Check className="text-success" /> : <Copy />}
                  </Button>
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Google Authenticator, 1Password, Authy — any TOTP app works. Or paste the setup link:{" "}
                  <span className="break-all font-mono">{stage.otpauthUrl.slice(0, 60)}…</span>
                </p>
              </div>

              <div className="rounded-[12px] border border-border bg-muted/40 p-4">
                <p className="text-[13px] font-medium">2 · Enter the current 6-digit code to confirm</p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="max-w-[160px] text-center tracking-[0.3em]"
                    autoComplete="one-time-code"
                  />
                  <Button onClick={confirm} disabled={busy || !code}>
                    {busy && <Loader2 className="animate-spin" />}
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}

          {stage.step === "enabled" && (
            <div className="space-y-4">
              {stage.recoveryCodes && (
                <div className="rounded-[12px] border border-warning/40 bg-[var(--warning-soft)] p-4">
                  <p className="text-[13px] font-semibold">Save your recovery codes now</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Each works once if you lose your authenticator. They will not be shown again.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[13px]">
                    {stage.recoveryCodes.map((c) => (
                      <code key={c} className="rounded-[8px] bg-surface px-2.5 py-1.5">{c}</code>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="max-w-[240px] flex-1 space-y-1.5">
                  <Label htmlFor="password">Confirm password to disable</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button variant="destructive" onClick={disable} disabled={busy || !password}>
                  {busy ? <Loader2 className="animate-spin" /> : <ShieldOff />}
                  Disable
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
