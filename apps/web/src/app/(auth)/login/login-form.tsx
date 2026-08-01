"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

const oauthErrors: Record<string, string> = {
  no_account: "No workspace account matches that email. Ask your admin for an invite first.",
  no_email: "Your provider did not share an email address.",
  provider_failed: "Sign-in with the provider failed. Try again.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(() => {
    const oauthError = searchParams.get("oauth_error");
    return oauthError ? (oauthErrors[oauthError] ?? "Sign-in failed.") : null;
  });
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [exchanging, setExchanging] = useState(() => Boolean(searchParams.get("oauth_code")));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const finish = () => {
    router.replace(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  };

  // Returning from an OAuth provider: swap the one-time code for a session.
  useEffect(() => {
    const oauthCode = searchParams.get("oauth_code");
    if (!oauthCode) return;

    fetch("/api/auth/oauth-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: oauthCode }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setServerError(json?.error?.message ?? "Sign-in failed.");
          return;
        }
        if (json.data.two_factor_required) {
          setChallengeToken(json.data.challenge_token);
          return;
        }
        finish();
      })
      .finally(() => setExchanging(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);

    if (!res) {
      setServerError("Network error — check your connection and try again.");
      return;
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const fieldError = json?.errors ? (Object.values(json.errors)[0] as string[])?.[0] : undefined;
      setServerError(json?.error?.message ?? json?.message ?? fieldError ?? "Sign in failed.");
      return;
    }

    if (json.data.two_factor_required) {
      setChallengeToken(json.data.challenge_token);
      return;
    }

    finish();
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setVerifying(true);

    const res = await fetch("/api/auth/two-factor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    }).catch(() => null);

    setVerifying(false);
    const json = await res?.json().catch(() => null);

    if (!res?.ok) {
      const fieldError = json?.errors ? (Object.values(json.errors)[0] as string[])?.[0] : undefined;
      setServerError(json?.error?.message ?? fieldError ?? "Verification failed.");
      if (json?.errors?.challenge_token) setChallengeToken(null); // expired → back to password
      return;
    }

    finish();
  };

  if (exchanging) {
    return (
      <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Completing sign-in…
      </div>
    );
  }

  if (challengeToken) {
    return (
      <form className="mt-8 space-y-4" onSubmit={submitCode}>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-primary/25 bg-primary/8 px-3 py-2.5">
          <ShieldCheck className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
          <p className="text-[13px]">Enter the 6-digit code from your authenticator app, or a recovery code.</p>
        </div>

        {serverError && (
          <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
            {serverError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            autoFocus
            className="text-center text-lg tracking-[0.3em]"
          />
        </div>

        <Button className="w-full" size="lg" type="submit" disabled={verifying || !code}>
          {verifying && <Loader2 className="animate-spin" />}
          Verify
        </Button>

        <button
          type="button"
          onClick={() => {
            setChallengeToken(null);
            setCode("");
            setServerError(null);
          }}
          className="w-full text-center text-[13px] text-muted-foreground hover:text-foreground"
        >
          Back to password
        </button>
      </form>
    );
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && (
        <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-[13px] text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
