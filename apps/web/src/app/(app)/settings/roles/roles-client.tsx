"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  type MemberRow,
  type RoleRow,
  useAssignRoles,
  useDeleteRole,
  useMembers,
  usePermissionsCatalog,
  useRoles,
  useSaveRole,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  hr: "Human Resources",
  projects: "Projects",
  documents: "Documents",
  crm: "CRM",
  finance: "Finance",
  helpdesk: "Help Desk",
  knowledge: "Knowledge Base",
  calendar: "Calendar",
  inventory: "Inventory",
  lms: "Training",
  settings: "Settings",
};

function RoleEditorDialog({ role, onDone }: { role: RoleRow | null; onDone: () => void }) {
  const { data: catalog } = usePermissionsCatalog();
  const save = useSaveRole();
  const [name, setName] = useState(role?.name ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);

  const groups = (catalog ?? []).reduce<Record<string, typeof catalog>>((acc, perm) => {
    (acc[perm.group] ??= []).push(perm);
    return acc;
  }, {});

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent
        title={role ? `Edit ${role.name}` : "New custom role"}
        description="Pick exactly what this role can see and do."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="r-name">Role name</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Associate" />
          </div>
          <div className="max-h-80 space-y-4 overflow-y-auto rounded-[10px] border border-border p-3">
            {Object.entries(groups).map(([group, perms]) => (
              <div key={group}>
                <p className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {GROUP_LABELS[group] ?? group}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(perms ?? []).map((perm) => (
                    <label
                      key={perm.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] text-foreground hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(perm.key)}
                        onChange={() => toggle(perm.key)}
                        className="size-3.5 accent-[var(--primary,#2DA9DD)]"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-muted-foreground">{selected.length} permission{selected.length === 1 ? "" : "s"} selected</p>
            <Button
              onClick={() =>
                save.mutate(
                  { id: role?.id, name, permissions: selected },
                  {
                    onSuccess: onDone,
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the role."),
                  },
                )
              }
              disabled={save.isPending || name.trim() === "" || selected.length === 0}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {role ? "Save changes" : "Create role"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberRolesDialog({ member, roles, onDone }: { member: MemberRow; roles: RoleRow[]; onDone: () => void }) {
  const assign = useAssignRoles();
  const [selected, setSelected] = useState<number[]>(member.roles.map((r) => r.id));
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent title={`Roles — ${member.name}`}>
        <div className="space-y-4">
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-[10px] border border-border p-2">
            {roles.map((role) => (
              <label
                key={role.id}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(role.id)}
                    onChange={() => toggle(role.id)}
                    className="size-3.5 accent-[var(--primary,#2DA9DD)]"
                  />
                  {role.name}
                </span>
                {role.is_system ? <Badge variant="neutral">System</Badge> : <Badge variant="primary">Custom</Badge>}
              </label>
            ))}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                assign.mutate(
                  { userId: member.id, role_ids: selected },
                  {
                    onSuccess: onDone,
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update roles."),
                  },
                )
              }
              disabled={assign.isPending || selected.length === 0}
            >
              {assign.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save roles
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RolesClient() {
  const [tab, setTab] = useState<"roles" | "members">("roles");
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: members, isLoading: membersLoading } = useMembers();
  const deleteRole = useDeleteRole();
  const [editing, setEditing] = useState<RoleRow | null | "new">(null);
  const [assigning, setAssigning] = useState<MemberRow | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to settings">
            <Link href="/settings"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Roles & members</h1>
            <p className="text-sm text-muted-foreground">Who can do what across the workspace.</p>
          </div>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New role
        </Button>
      </div>

      <div className="flex w-fit rounded-full border border-border bg-surface p-0.5">
        {(["roles", "members"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] capitalize transition",
              tab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "roles" ? (
        rolesLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-2">
            {(roles ?? []).map((role) => (
              <Card key={role.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    <ShieldCheck className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {role.name}
                      {role.is_system ? <Badge variant="neutral">System</Badge> : <Badge variant="primary">Custom</Badge>}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {role.key === "super_admin"
                        ? "Full access to everything"
                        : `${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"}`}
                      {" · "}
                      {role.members} member{role.members === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {!role.is_system ? (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label="Edit role" onClick={() => setEditing(role)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete role"
                      className="text-danger"
                      onClick={() => {
                        if (window.confirm(`Delete the ${role.name} role? Members lose its permissions.`)) {
                          deleteRole.mutate(role.id);
                        }
                      }}
                      disabled={deleteRole.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : membersLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-2">
          {(members ?? []).map((member) => (
            <Card key={member.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-medium text-foreground">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="hidden flex-wrap justify-end gap-1 sm:flex">
                  {member.roles.map((role) => (
                    <Badge key={role.id} variant="neutral">{role.name}</Badge>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setAssigning(member)}>
                  <UsersRound className="size-4" />
                  Roles
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== null ? (
        <RoleEditorDialog role={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : null}
      {assigning ? (
        <MemberRolesDialog member={assigning} roles={roles ?? []} onDone={() => setAssigning(null)} />
      ) : null}
    </div>
  );
}
