"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, History, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type InventoryItemRow,
  useCreateItem,
  useInventory,
  useItemMovements,
  useMoveStock,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const CATEGORIES = ["equipment", "consumables", "furniture", "stock", "other"];

function NewItemDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", category: "equipment", quantity: "0", reorder_level: "0", unit_cost: "", location: "" });
  const [error, setError] = useState<string | null>(null);
  const create = useCreateItem();

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    setError(null);
    create.mutate(
      {
        name: form.name,
        sku: form.sku,
        category: form.category,
        quantity: Number(form.quantity) || 0,
        reorder_level: Number(form.reorder_level) || 0,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
        location: form.location || undefined,
      },
      {
        onSuccess: () => { setOpen(false); setForm({ name: "", sku: "", category: "equipment", quantity: "0", reorder_level: "0", unit_cost: "", location: "" }); },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the item."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New item
        </Button>
      </DialogTrigger>
      <DialogContent title="New inventory item">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="i-name">Name</Label>
              <Input id="i-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. HP EliteBook 840" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="i-sku">SKU</Label>
              <Input id="i-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="e.g. LAP-001" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="i-cat">Category</Label>
              <Select id="i-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="i-qty">Opening qty</Label>
              <Input id="i-qty" type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="i-reorder">Reorder at</Label>
              <Input id="i-reorder" type="number" min={0} value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="i-cost">Unit cost (₦)</Label>
              <Input id="i-cost" type="number" min={0} value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="i-loc">Location</Label>
              <Input id="i-loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Head Office store" />
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={create.isPending || !form.name.trim() || !form.sku.trim()}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Add item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoveStockDialog({ item, onDone }: { item: InventoryItemRow; onDone: () => void }) {
  const move = useMoveStock();
  const [kind, setKind] = useState("in");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent
        title={`Stock movement — ${item.name}`}
        description={`Currently ${item.quantity} ${item.unit}${item.quantity === 1 ? "" : "s"} on hand.`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="m-kind">Movement</Label>
              <Select id="m-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="in">Stock in</option>
                <option value="out">Stock out</option>
                <option value="adjust">Adjust (set absolute)</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="m-qty">{kind === "adjust" ? "New quantity" : "Quantity"}</Label>
              <Input id="m-qty" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-note">Note</Label>
            <Input id="m-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Issued to new hires" />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                move.mutate(
                  { id: item.id, kind, quantity: Number(quantity), note: note || undefined },
                  {
                    onSuccess: onDone,
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Movement failed."),
                  },
                )
              }
              disabled={move.isPending || !(Number(quantity) > 0)}
            >
              {move.isPending ? <Loader2 className="size-4 animate-spin" /> : kind === "out" ? <ArrowUpFromLine className="size-4" /> : <ArrowDownToLine className="size-4" />}
              Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ item, onDone }: { item: InventoryItemRow; onDone: () => void }) {
  const { data: movements, isLoading } = useItemMovements(item.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent title={`History — ${item.name}`}>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(movements ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-[10px] border border-border p-2.5 text-sm">
                <div>
                  <p className="text-foreground">
                    <span className={m.kind === "out" ? "text-danger" : m.kind === "in" ? "text-success" : "text-foreground"}>
                      {m.kind === "in" ? "+" : m.kind === "out" ? "−" : "="}{m.quantity}
                    </span>{" "}
                    <span className="capitalize text-muted-foreground">({m.kind})</span>
                  </p>
                  {m.note ? <p className="text-[12px] text-muted-foreground">{m.note}</p> : null}
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {m.by ?? "—"} · {new Date(m.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InventoryClient() {
  const [search, setSearch] = useState("");
  const [moving, setMoving] = useState<InventoryItemRow | null>(null);
  const [history, setHistory] = useState<InventoryItemRow | null>(null);
  const { data, isLoading } = useInventory(search);

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Equipment, consumables and stock levels.</p>
        </div>
        <NewItemDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardDescription>Items</CardDescription><CardTitle className="text-2xl">{meta?.total_items ?? "—"}</CardTitle></CardHeader>
          <CardContent className="pt-0" />
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Low stock</CardDescription>
            <CardTitle className={`text-2xl ${meta && meta.low_stock > 0 ? "text-danger" : ""}`}>{meta?.low_stock ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0" />
        </Card>
        <Card>
          <CardHeader><CardDescription>Stock value</CardDescription><CardTitle className="text-2xl">{meta ? naira.format(meta.stock_value) : "—"}</CardTitle></CardHeader>
          <CardContent className="pt-0" />
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU…" className="pl-9" />
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Boxes className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">{search ? "Nothing matches that search." : "No items yet — add the first one."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th className="p-3 font-medium">Item</th>
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">On hand</th>
                  <th className="p-3 font-medium">Unit cost</th>
                  <th className="p-3 font-medium">Location</th>
                  <th className="p-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{item.name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="p-3 capitalize text-muted-foreground">{item.category ?? "—"}</td>
                    <td className="p-3">
                      <span className="text-foreground">{item.quantity} {item.unit}{item.quantity === 1 ? "" : "s"}</span>
                      {item.low_stock ? <Badge variant="danger" className="ml-2">Low</Badge> : null}
                    </td>
                    <td className="p-3 text-muted-foreground">{item.unit_cost !== null ? naira.format(item.unit_cost) : "—"}</td>
                    <td className="p-3 text-muted-foreground">{item.location ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Stock movement" onClick={() => setMoving(item)}>
                          <SlidersHorizontal className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="History" onClick={() => setHistory(item)}>
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

      {moving ? <MoveStockDialog item={moving} onDone={() => setMoving(null)} /> : null}
      {history ? <HistoryDialog item={history} onDone={() => setHistory(null)} /> : null}
    </div>
  );
}
