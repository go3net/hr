"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  EMPLOYEE_FILE_TYPES,
  useDeleteEmployeeFile,
  useEmployeeFiles,
  useUploadEmployeeFile,
  type EmployeeFile,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadDialog({ publicId, onClose }: { publicId: string; onClose: () => void }) {
  const upload = useUploadEmployeeFile(publicId);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("id_card");
  const [expiresOn, setExpiresOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Add a document"
        description="An ID card, certificate or signed contract — filed against this person."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return;
            setError(null);
            upload.mutate(
              { file, type, expiresOn: expiresOn || undefined },
              {
                onSuccess: onClose,
                onError: (err) =>
                  setError(err instanceof ApiError ? err.message : "Could not upload that file."),
              },
            );
          }}
        >
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <div className="grid gap-2">
            <Label htmlFor="doc-type">What is it?</Label>
            <Select id="doc-type" value={type} onChange={(e) => setType(e.target.value)}>
              {EMPLOYEE_FILE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-file">File</Label>
            <input
              id="doc-file"
              ref={input}
              type="file"
              className="text-[13px] file:mr-3 file:rounded-[8px] file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-[13px]"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-[12px] text-muted-foreground">Up to 25 MB.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="doc-expiry">Expires on (optional)</Label>
            <Input
              id="doc-expiry"
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
            <p className="text-[12px] text-muted-foreground">
              For anything that lapses — a passport, a work permit, a licence.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!file || upload.isPending}>
              {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The paperwork held on this person.
 *
 * The documents module files by folder, which answers "what is in
 * Contracts?" — not "what do we hold on this employee?", which is the
 * question HR and an audit both ask.
 */
export function DocumentsSection({
  publicId,
  employeeName,
  canManage,
}: {
  publicId: string;
  employeeName: string;
  canManage: boolean;
}) {
  const { data: files, isPending } = useEmployeeFiles(publicId);
  const remove = useDeleteEmployeeFile(publicId);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState<EmployeeFile | null>(null);

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Documents</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            ID cards, certificates and contracts filed against {employeeName.split(" ")[0]}.
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setUploading(true)}>
            <Upload className="size-4" />
            Add document
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <Skeleton className="h-24" />
      ) : files?.length ? (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border p-3"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {f.type_label} · {readableSize(f.size_bytes)}
                  {f.uploaded_by ? ` · added by ${f.uploaded_by}` : ""}
                </p>
              </div>
              {f.expires_on ? (
                <Badge variant={f.has_expired ? "danger" : "neutral"}>
                  {f.has_expired ? "Expired" : "Expires"} {formatDate(f.expires_on)}
                </Badge>
              ) : null}
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="icon" aria-label={`Download ${f.name}`}>
                  <a href={`/api/backend/hr/employees/${publicId}/documents/${f.id}/download`}>
                    <Download className="size-4" />
                  </a>
                </Button>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger"
                    aria-label={`Delete ${f.name}`}
                    onClick={() => setConfirming(f)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Nothing filed yet{canManage ? " — add their ID card or certificates." : "."}
        </p>
      )}

      {uploading ? <UploadDialog publicId={publicId} onClose={() => setUploading(false)} /> : null}

      {confirming ? (
        <Dialog open onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent
            title={`Delete ${confirming.name}?`}
            description="The file is removed as well, so this cannot be undone."
          >
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(confirming.id, { onSuccess: () => setConfirming(null) })
                }
              >
                {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
