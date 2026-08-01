import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CreditCard, Palette, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SecurityClient } from "./security-client";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  {
    href: "/settings/billing",
    icon: CreditCard,
    title: "Billing & plans",
    blurb: "Manage your subscription, choose a plan and view payment history.",
  },
  {
    href: "/settings/branding",
    icon: Palette,
    title: "Branding",
    blurb: "Workspace name, logo and colors — make it yours.",
  },
  {
    href: "/settings/roles",
    icon: ShieldCheck,
    title: "Roles & members",
    blurb: "Create custom roles and control who can do what.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <SecurityClient />
      <div className="max-w-2xl space-y-3">
        {SECTIONS.map((section) => (
          <Card key={section.href}>
            <Link
              href={section.href}
              className="flex items-center justify-between gap-3 p-5 transition hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <section.icon className="size-4.5" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{section.title}</p>
                  <p className="text-[13px] text-muted-foreground">{section.blurb}</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
