"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Check, CreditCard, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type PlanRow,
  useBilling,
  useStartCheckout,
  useVerifyPayment,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const STATE_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Active", variant: "success" },
  trial: { label: "Trial", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
  complimentary: { label: "Complimentary", variant: "neutral" },
};

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days > 0 ? days : 0;
}

function PlanCard({
  plan,
  current,
  highlight,
  onChoose,
  busy,
  disabled,
}: {
  plan: PlanRow;
  current: boolean;
  highlight: boolean;
  onChoose: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative flex flex-col p-5",
        highlight && "border-primary/50 shadow-pop",
      )}
    >
      {highlight ? (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-white">
          Most popular
        </span>
      ) : null}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">{plan.name}</h3>
        {current ? <Badge variant="success">Current</Badge> : null}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{plan.blurb}</p>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {naira.format(plan.price)}
        <span className="text-sm font-normal text-muted-foreground">/month</span>
      </p>
      <ul className="mt-4 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[13px] text-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        className="mt-5 w-full"
        variant={highlight ? "primary" : "outline"}
        onClick={onChoose}
        disabled={disabled || busy}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
        {current ? "Renew" : "Choose plan"}
      </Button>
    </Card>
  );
}

export function BillingClient() {
  const searchParams = useSearchParams();
  const { data: billing, isLoading } = useBilling();
  const checkout = useStartCheckout();
  const verify = useVerifyPayment();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  // Paystack redirects back with ?reference= — confirm it exactly once.
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const verifiedReference = useRef<string | null>(null);
  const verifyMutate = verify.mutate;
  useEffect(() => {
    if (reference && verifiedReference.current !== reference) {
      verifiedReference.current = reference;
      verifyMutate(reference);
    }
  }, [reference, verifyMutate]);

  const choose = (plan: string) => {
    setError(null);
    setChosen(plan);
    checkout.mutate(plan, {
      onSuccess: (res) => {
        window.location.href = res.authorization_url;
      },
      onError: (err) => {
        setChosen(null);
        setError(err instanceof ApiError ? err.message : "Could not start checkout.");
      },
    });
  };

  const state = billing ? STATE_LABEL[billing.state] : null;
  const trialDays = daysLeft(billing?.trial_ends_at ?? null);
  const periodDays = daysLeft(billing?.subscription_ends_at ?? null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to settings">
          <Link href="/settings"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">Your plan, payments and renewal.</p>
        </div>
      </div>

      {verify.isPending ? (
        <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Confirming your payment…
        </Card>
      ) : verify.data?.activated ? (
        <Card className="flex items-center gap-3 border-success/40 p-4 text-sm text-foreground">
          <BadgeCheck className="size-5 text-success" />
          Payment confirmed — your subscription is active.
        </Card>
      ) : null}

      {isLoading || !billing ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Current subscription</CardTitle>
                <CardDescription>
                  {billing.state === "trial" && trialDays !== null
                    ? `Free trial — ${trialDays} day${trialDays === 1 ? "" : "s"} left.`
                    : billing.state === "active" && periodDays !== null
                      ? `${billing.plan_name ?? "Plan"} — renews in ${periodDays} day${periodDays === 1 ? "" : "s"}.`
                      : billing.state === "expired"
                        ? "Your access has ended. Choose a plan below to reactivate the workspace."
                        : "This workspace is on a complimentary plan."}
                </CardDescription>
              </div>
              {state ? <Badge variant={state.variant}>{state.label}</Badge> : null}
            </CardHeader>
            <CardContent className="pt-0" />
          </Card>

          {!billing.configured ? (
            <Card className="p-4 text-sm text-muted-foreground">
              Payments are not configured yet — add{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">PAYSTACK_SECRET_KEY</code> to
              the API environment to enable checkout.
            </Card>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="grid gap-4 sm:grid-cols-3">
            {billing.plans.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                current={billing.plan_key === plan.key && billing.state === "active"}
                highlight={plan.key === "growth"}
                onChoose={() => choose(plan.key)}
                busy={checkout.isPending && chosen === plan.key}
                disabled={!billing.configured || checkout.isPending}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
              <CardDescription>The most recent charges on this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              {billing.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Plan</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Channel</th>
                        <th className="pb-2 font-medium">Reference</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2.5 text-foreground">
                            {new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </td>
                          <td className="py-2.5 capitalize text-foreground">{payment.plan_key}</td>
                          <td className="py-2.5 text-foreground">{naira.format(payment.amount)}</td>
                          <td className="py-2.5 capitalize text-muted-foreground">{payment.channel ?? "—"}</td>
                          <td className="py-2.5 font-mono text-xs text-muted-foreground">{payment.reference}</td>
                          <td className="py-2.5">
                            <Badge
                              variant={payment.status === "paid" ? "success" : payment.status === "failed" ? "danger" : "warning"}
                            >
                              {payment.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
