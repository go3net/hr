"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, Palette, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { hasPermission } from "@/components/auth/require-permission";
import { useBootstrap } from "@/hooks/use-api";

const SECTIONS = [
  {
    href: "/settings/billing",
    icon: CreditCard,
    title: "Billing & plans",
    blurb: "Manage your subscription, choose a plan and view payment history.",
    permission: "settings.billing.manage",
  },
  {
    href: "/settings/branding",
    icon: Palette,
    title: "Branding",
    blurb: "Workspace name, logo and colors — make it yours.",
    permission: "settings.branding.manage",
  },
  {
    href: "/settings/roles",
    icon: ShieldCheck,
    title: "Roles & members",
    blurb: "Create custom roles and control who can do what.",
    permission: "settings.roles.manage",
  },
];

/**
 * Personal security settings (password, 2FA) stay on the settings page for
 * everyone; these workspace-administration sections do not.
 */
export function SettingsSections() {
  const { data: session } = useBootstrap();
  const sections = SECTIONS.filter((s) => hasPermission(session?.permissions, s.permission));

  if (sections.length === 0) return null;

  return (
    <div className="max-w-2xl space-y-3">
      {sections.map((section) => (
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
  );
}
