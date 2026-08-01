"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Palette, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { useBranding, useUpdateBranding, useUploadLogo } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

const DEFAULT_PRIMARY = "#2DA9DD";
const DEFAULT_ACCENT = "#00C2FF";

export function BrandingClient() {
  const { data: branding, isLoading } = useBranding();
  const update = useUpdateBranding();
  const upload = useUploadLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (branding && !loadedRef.current) {
      loadedRef.current = true;
      setName(branding.display_name ?? "");
      setPrimary(branding.primary_color ?? DEFAULT_PRIMARY);
      setAccent(branding.accent_color ?? DEFAULT_ACCENT);
    }
  }, [branding]);

  const save = () => {
    setError(null);
    setSaved(false);
    update.mutate(
      {
        display_name: name || null,
        primary_color: primary === DEFAULT_PRIMARY ? null : primary,
        accent_color: accent === DEFAULT_ACCENT ? null : accent,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save branding."),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to settings">
          <Link href="/settings"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Branding</h1>
          <p className="text-sm text-muted-foreground">Make the workspace look like your company.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Name and logo shown across the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="b-name">Workspace name</Label>
                <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Go3net Office" />
              </div>
              <div className="flex items-center gap-3">
                {branding?.has_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tenant logo streams through the authenticated BFF
                  <img src="/api/backend/settings/branding/logo" alt="Logo" className="size-12 rounded-lg border border-border object-contain" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                    <Palette className="size-5" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      upload.mutate(file, {
                        onError: (err) => setError(err instanceof ApiError ? err.message : "Upload failed."),
                      });
                    }
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                  {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Upload logo
                </Button>
                <p className="text-[12px] text-muted-foreground">PNG, JPG, WebP or SVG · max 2 MB</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
              <CardDescription>Applied instantly for everyone in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {([
                  ["Primary", primary, setPrimary],
                  ["Accent", accent, setAccent],
                ] as const).map(([label, value, setter]) => (
                  <div key={label} className="grid gap-2">
                    <Label>{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="size-9 cursor-pointer rounded-[10px] border border-border bg-surface"
                        aria-label={`${label} color`}
                      />
                      <Input
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-[10px] border border-border p-4">
                <p className="mb-2 text-[12px] text-muted-foreground">Preview</p>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-[10px] px-4 py-2 text-sm font-medium text-white"
                    style={{ background: primary }}
                  >
                    Primary button
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-[12px] font-medium text-white"
                    style={{ background: accent }}
                  >
                    Accent
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPrimary(DEFAULT_PRIMARY); setAccent(DEFAULT_ACCENT); }}
                >
                  Reset to defaults
                </Button>
                <Button onClick={save} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
                  {saved ? "Saved" : "Save branding"}
                </Button>
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
