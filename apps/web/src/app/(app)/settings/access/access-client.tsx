"use client";

import { useState } from "react";
import { KeyRound, Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useAccountAccess,
  useIssueResetLink,
  useSetMemberPassword,
  type AccessRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

/** Readable rather than clever — it gets copied into a chat and typed back. */
function suggestPassword(): string {
  const words = ["harbour", "lantern", "compass", "meadow", "cobalt", "falcon", "ember", "ridge"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  active: { label: "Active", variant: "success" },
  invited: { label: "Invited", variant: "warning" },
  disabled: { label: "Disabled", variant: "danger" },
};

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <div className="break-all rounded-[10px] border border-border bg-muted/40 p-3 font-mono text-[13px]">
        {value}
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : label}
        </Button>
      </div>
    </div>
  );
}

/**
 * Set a password on someone's behalf.
 *
 * The password is shown once, here, because nothing emails it and the
 * administrator has to be able to pass it on. Setting it drops that account's
 * existing sessions, so whoever was signed in on the old one — including
 * whoever locked them out — is signed out.
 */
function SetPasswordDialog({ member, onClose }: { member: AccessRow; onClose: () => void }) {
  const setPassword = useSetMemberPassword();
  const [password, setPassword_] = useState(() => suggestPassword());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          title={`${member.name} can sign in again`}
          description="Give them this password — it is not shown again, and it is not emailed. Ask them to change it once they are in."
        >
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Signing in with <span className="font-medium text-foreground">{member.email}</span>
            </p>
            <CopyBox value={password} label="Copy password" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`Set a password for ${member.name}`}
        description="Use this when they cannot open a reset link. You will see the password once, to pass on."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setPassword.mutate(
              { id: member.id, password },
              {
                onSuccess: () => setDone(true),
                onError: (err) =>
                  setError(err instanceof ApiError ? err.message : "Could not set this password."),
              },
            );
          }}
        >
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <div className="grid gap-2">
            <Label htmlFor="new-pass">New password</Label>
            <div className="flex gap-2">
              <Input
                id="new-pass"
                value={password}
                onChange={(e) => setPassword_(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="button" variant="outline" onClick={() => setPassword_(suggestPassword())}>
                <RefreshCw className="size-4" />
                Suggest
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              At least 10 characters, with letters and numbers.
            </p>
          </div>

          <p className="rounded-[10px] border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
            This signs {member.name.split(" ")[0]} out everywhere. You will know their password, so
            ask them to change it from their profile once they are back in — a reset link avoids
            that, when they can open one.
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={setPassword.isPending || password.length < 10}>
              {setPassword.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Set password
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One place to get anybody back into their account.
 *
 * With no mail configured, a link that only arrives by email is no help, so
 * both routes end with something to hand over: a link they open themselves,
 * or a password set for them when a link will not do.
 */
export function AccessClient() {
  const { data: members, isPending } = useAccountAccess();
  const issueLink = useIssueResetLink();
  const [linkFor, setLinkFor] = useState<{ member: AccessRow; url: string } | null>(null);
  const [passwordFor, setPasswordFor] = useState<AccessRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em]">
          <ShieldCheck className="size-5 text-primary" strokeWidth={1.75} />
          Staff access
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Get someone back into their account. Send them a reset link, or set a password and pass it
          on — email is not sending yet, so either way you hand it over yourself.
        </p>
      </div>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Last signed in</th>
                <th className="px-4 py-3 text-right">Get them back in</th>
              </tr>
            </thead>
            <tbody>
              {isPending &&
                [1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))}

              {members?.map((m) => {
                const status = STATUS[m.status ?? ""] ?? { label: "No account", variant: "neutral" as const };
                return (
                  <tr key={m.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {m.name}
                        {m.is_self ? <span className="ml-2 text-[12px] text-muted-foreground">(you)</span> : null}
                      </p>
                      <p className="text-[12px] text-muted-foreground">{m.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.roles.join(", ") || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        {m.is_self ? (
                          <span className="text-[12px] text-muted-foreground">Use your own profile</span>
                        ) : !m.can_manage ? (
                          <span className="text-[12px] text-muted-foreground">
                            Administrator — owner only
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={issueLink.isPending}
                              onClick={() => {
                                setError(null);
                                issueLink.mutate(m.id, {
                                  onSuccess: (res) => setLinkFor({ member: m, url: res.reset_url }),
                                  onError: (err) =>
                                    setError(
                                      err instanceof ApiError ? err.message : "Could not create a link.",
                                    ),
                                });
                              }}
                            >
                              <Link2 className="size-4" />
                              Reset link
                            </Button>
                            <Button size="sm" onClick={() => setPasswordFor(m)}>
                              <KeyRound className="size-4" />
                              Set password
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!isPending && members?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                    Nobody has an account in this workspace yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {linkFor ? (
        <Dialog open onOpenChange={(open) => !open && setLinkFor(null)}>
          <DialogContent
            title={`Reset link for ${linkFor.member.name}`}
            description="Send this to them however you like. It works once and expires in 60 minutes, and they choose the password themselves."
          >
            <CopyBox value={linkFor.url} label="Copy link" />
          </DialogContent>
        </Dialog>
      ) : null}

      {passwordFor ? (
        <SetPasswordDialog member={passwordFor} onClose={() => setPasswordFor(null)} />
      ) : null}
    </div>
  );
}
