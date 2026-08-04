"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useVisibleNav } from "@/components/layout/nav-config";
import { NavLinks } from "@/components/layout/nav-links";
import { WorkspaceMark } from "@/components/layout/workspace-mark";

export function Sidebar() {
  const { groups, workspaceName, logo } = useVisibleNav();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <WorkspaceMark name={workspaceName} hasLogo={logo} />
        <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{workspaceName}</span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <NavLinks groups={groups} />
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-[18px]" strokeWidth={1.75} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
