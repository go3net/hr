"use client";

import { useState } from "react";
import { History, Laptop, Loader2, Plus, Search, UserRoundCheck, Undo2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type AssetRow,
  useAssetHistory,
  useAssets,
  useAssignAsset,
  useCreateAsset,
  useEmployees,
  useReturnAsset,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  available: "success",
  assigned: "primary",
  maintenance: "warning",
  retired: "neutral",
};

const CATEGORIES = ["laptop", "phone", "monitor", "furniture", "vehicle", "other"];

function NewAssetDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", tag: "", category: "laptop", serial_number: "" });
  const [error, setError] = useState<string | null>(null);
  const create = useCreateAsset();

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New asset
        </Button>
      </DialogTrigger>
      <DialogContent title="Register asset">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="as-name">Name</Label>
              <Input id="as-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder='e.g. MacBook Pro 14"' />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="as-tag">Asset tag</Label>
              <Input id="as-tag" value={form.tag} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. G3N-LAP-01" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="as-cat">Category</Label>
              <Select id="as-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="as-serial">Serial number</Label>
              <Input id="as-serial" value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                create.mutate(
                  { ...form, serial_number: form.serial_number || undefined },
                  {
                    onSuccess: () => { setOpen(false); setForm({ name: "", tag: "", category: "laptop", serial_number: "" }); },
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not register the asset."),
                  },
                )
              }
              disabled={create.isPending || !form.name.trim() || !form.tag.trim()}
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Register
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ asset, onDone }: { asset: AssetRow; onDone: () => void }) {
  const { data: employees } = useEmployees("");
  const assign = useAssignAsset();
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = (employees ?? []).filter((e) => e.status === "active");

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent title={`Assign ${asset.name}`} description={`Tag ${asset.tag}`}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="assign-emp">Employee</Label>
            <Select id="assign-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Choose…</option>
              {active.map((e) => (
                <option key={e.id} value={e.employee_id}>{e.name} ({e.employee_code})</option>
              ))}
            </Select>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                assign.mutate(
                  { id: asset.id, employee_id: Number(employeeId) },
                  {
                    onSuccess: onDone,
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not assign."),
                  },
                )
              }
              disabled={assign.isPending || employeeId === ""}
            >
              {assign.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />}
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ asset, onDone }: { asset: AssetRow; onDone: () => void }) {
  const { data: history, isLoading } = useAssetHistory(asset.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent title={`History — ${asset.tag}`}>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : (history ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Never assigned.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(history ?? []).map((h) => (
              <div key={h.id} className="rounded-[10px] border border-border p-2.5 text-sm">
                <p className="font-medium text-foreground">{h.employee ?? "—"}</p>
                <p className="text-[12px] text-muted-foreground">
                  {new Date(h.assigned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {" → "}
                  {h.returned_at
                    ? new Date(h.returned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "still out"}
                </p>
                {h.condition_note ? <p className="text-[12px] text-muted-foreground">{h.condition_note}</p> : null}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AssetsClient() {
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<AssetRow | null>(null);
  const [history, setHistory] = useState<AssetRow | null>(null);
  const { data, isLoading } = useAssets(search);
  const returnAsset = useReturnAsset();

  const assets = data?.assets ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Company assets</h1>
          <p className="text-sm text-muted-foreground">Who has what, and where it&apos;s been.</p>
        </div>
        <NewAssetDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardDescription>Total</CardDescription><CardTitle className="text-2xl">{meta?.total ?? "—"}</CardTitle></CardHeader><CardContent className="pt-0" /></Card>
        <Card><CardHeader><CardDescription>Assigned</CardDescription><CardTitle className="text-2xl">{meta?.assigned ?? "—"}</CardTitle></CardHeader><CardContent className="pt-0" /></Card>
        <Card><CardHeader><CardDescription>Available</CardDescription><CardTitle className="text-2xl">{meta?.available ?? "—"}</CardTitle></CardHeader><CardContent className="pt-0" /></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, tag or serial…" className="pl-9" />
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : assets.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Laptop className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">{search ? "Nothing matches." : "No assets registered yet."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th className="p-3 font-medium">Asset</th>
                  <th className="p-3 font-medium">Tag</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Assigned to</th>
                  <th className="p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{asset.name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{asset.tag}</td>
                    <td className="p-3 capitalize text-muted-foreground">{asset.category}</td>
                    <td className="p-3"><Badge variant={STATUS_VARIANT[asset.status]}>{asset.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{asset.assigned_to ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        {asset.status === "available" ? (
                          <Button variant="ghost" size="icon" aria-label="Assign" onClick={() => setAssigning(asset)}>
                            <UserRoundCheck className="size-4" />
                          </Button>
                        ) : null}
                        {asset.status === "assigned" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Return"
                            onClick={() => returnAsset.mutate({ id: asset.id })}
                            disabled={returnAsset.isPending}
                          >
                            <Undo2 className="size-4" />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" aria-label="History" onClick={() => setHistory(asset)}>
                          <History className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {assigning ? <AssignDialog asset={assigning} onDone={() => setAssigning(null)} /> : null}
      {history ? <HistoryDialog asset={history} onDone={() => setHistory(null)} /> : null}
    </div>
  );
}
