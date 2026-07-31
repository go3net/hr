import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SecurityClient } from "./security-client";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <SecurityClient />
      <Card className="max-w-2xl">
        <Link
          href="/settings/billing"
          className="flex items-center justify-between gap-3 p-5 transition hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
              <CreditCard className="size-4.5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">Billing & plans</p>
              <p className="text-[13px] text-muted-foreground">
                Manage your subscription, choose a plan and view payment history.
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </Card>
    </div>
  );
}
