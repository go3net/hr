"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBootstrap } from "@/hooks/use-api";

export function hasPermission(permissions: string[] | undefined, required: string): boolean {
  if (!permissions) return false;
  return permissions.includes("*") || permissions.includes(required);
}

/**
 * Page-level guard. The sidebar already hides links a member cannot use, but
 * URLs get shared, bookmarked and typed — so the page itself says no rather
 * than rendering a shell that fills with failed requests.
 *
 * This is presentation only. The API enforces the same permission on every
 * endpoint behind these pages; nothing here is load-bearing for security.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useBootstrap();

  if (isPending) {
    return <Skeleton className="h-64" />;
  }

  if (!hasPermission(session?.permissions, permission)) {
    return (
      <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-muted">
          <Lock className="size-5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-medium">You don&apos;t have access to this page</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Ask an administrator if you need it for your role.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </Card>
    );
  }

  return <>{children}</>;
}
