"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, Settings, X } from "lucide-react";
import { useVisibleNav } from "@/components/layout/nav-config";
import { NavLinks } from "@/components/layout/nav-links";
import { WorkspaceMark } from "@/components/layout/workspace-mark";

/**
 * The whole menu on small screens, where the sidebar is hidden. A left
 * drawer rather than a bottom sheet: the nav is long and grouped, and this
 * keeps it identical in structure to the desktop sidebar.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { groups, workspaceName, logo } = useVisibleNav();

  // Links close the drawer on tap; this catches every other way the route
  // can change under it — back button, redirect, deep link. Adjusting state
  // during render rather than in an effect avoids a second paint with the
  // drawer still open.
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (open) setOpen(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          className="-ml-1 flex size-10 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" strokeWidth={1.75} />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in lg:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] flex-col border-r border-border bg-surface shadow-modal outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Navigate {workspaceName}
          </DialogPrimitive.Description>

          <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
            <WorkspaceMark name={workspaceName} hasLogo={logo} />
            <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{workspaceName}</span>
            <DialogPrimitive.Close
              className="ml-auto flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-4.5" strokeWidth={1.75} />
            </DialogPrimitive.Close>
          </div>

          {/* pb-[env(safe-area-inset-bottom)] keeps the last item clear of
              the iOS home indicator. */}
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} compact={false} />
          </nav>

          <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-[18px]" strokeWidth={1.75} />
              Settings
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
