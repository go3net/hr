"use client";

import { useRef, useState } from "react";
import {
  Folder as FolderIcon,
  FolderPlus,
  Upload,
  Search,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Trash2,
  Users,
  Lock,
  Loader2,
  ChevronRight,
  Home,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  useCreateFolder,
  useDeleteDocument,
  useDocuments,
  useShareDocument,
  useUploadDocument,
  useUsers,
  type DocumentRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function mimeIcon(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("pdf") || mime.startsWith("text/")) return FileText;
  if (mime.includes("sheet") || mime.includes("csv") || mime.includes("excel")) return FileSpreadsheet;
  return FileIcon;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NewFolderDialog({ parentId }: { parentId: number | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createFolder = useCreateFolder();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createFolder.mutate(
      { name, parent_id: parentId },
      {
        onSuccess: () => {
          setName("");
          setOpen(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create folder."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus /> New folder
        </Button>
      </DialogTrigger>
      <DialogContent title="New folder">
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Folder name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Policies" required />
          </div>
          <Button className="w-full" type="submit" disabled={createFolder.isPending}>
            {createFolder.isPending && <Loader2 className="animate-spin" />}
            Create folder
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ doc }: { doc: DocumentRow }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const { data: users } = useUsers();
  const share = useShareDocument();

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Share ${doc.name}`}>
          <Users />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Share · ${doc.name}`} description="Grant teammates access to this private document.">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {users?.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{u.email}</span>
              </span>
            </label>
          ))}
        </div>
        <Button
          className="mt-4 w-full"
          disabled={share.isPending || selected.length === 0}
          onClick={() => share.mutate({ id: doc.id, userIds: selected }, { onSuccess: () => setOpen(false) })}
        >
          {share.isPending && <Loader2 className="animate-spin" />}
          Share with {selected.length || "…"} {selected.length === 1 ? "person" : "people"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsClient() {
  const [folderId, setFolderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("tenant");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data, isPending } = useDocuments(folderId, search);
  const upload = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    upload.mutate(
      { file, folderId, visibility },
      { onError: (err) => setUploadError(err instanceof ApiError ? err.message : "Upload failed.") },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Documents</h1>
        <div className="flex items-center gap-2">
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-auto" aria-label="Upload visibility">
            <option value="tenant">Visible to everyone</option>
            <option value="private">Private to me</option>
          </Select>
          <NewFolderDialog parentId={folderId} />
          <input ref={fileInput} type="file" hidden onChange={onFilePicked} />
          <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Upload
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
          {uploadError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm" aria-label="Folder path">
          <button
            onClick={() => setFolderId(null)}
            className={cn(
              "flex items-center gap-1 rounded-[8px] px-2 py-1 transition-colors hover:bg-muted",
              folderId === null ? "font-medium" : "text-muted-foreground",
            )}
          >
            <Home className="size-3.5" strokeWidth={1.75} /> All files
          </button>
          {data?.breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground/60" strokeWidth={1.75} />
              <button
                onClick={() => setFolderId(crumb.id)}
                className={cn(
                  "rounded-[8px] px-2 py-1 transition-colors hover:bg-muted",
                  folderId === crumb.id ? "font-medium" : "text-muted-foreground",
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="relative ml-auto min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all documents…"
            className="h-9 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm shadow-card placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Folders */}
      {!search && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {isPending && [1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-[12px]" />)}
          {data?.folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setFolderId(folder.id)}
              className="flex items-center gap-3 rounded-[12px] border border-border bg-surface p-3.5 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-pop"
            >
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                <FolderIcon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{folder.name}</span>
                <span className="block text-[12px] text-muted-foreground">{folder.items} item{folder.items === 1 ? "" : "s"}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Files */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Uploaded by</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isPending && (
                <tr>
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              )}
              {data?.documents.map((doc) => {
                const Icon = mimeIcon(doc.mime);
                return (
                  <tr key={doc.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-[8px] bg-muted text-muted-foreground">
                          <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatSize(doc.size_bytes)}</td>
                    <td className="px-4 py-2.5">
                      {doc.visibility === "private" ? (
                        <Badge variant="warning"><Lock className="size-3" /> Private</Badge>
                      ) : (
                        <Badge variant="neutral">Everyone</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{doc.uploaded_by ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        {doc.visibility === "private" && <ShareDialog doc={doc} />}
                        <Button asChild size="sm" variant="ghost" aria-label={`Download ${doc.name}`}>
                          <a href={`/api/backend/documents/${doc.id}/download`} download>
                            <Download />
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${doc.name}`}
                          disabled={deleteDocument.isPending}
                          onClick={() => deleteDocument.mutate(doc.id)}
                        >
                          <Trash2 className="text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isPending && data?.documents.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                        <FileText className="size-5 text-primary" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {search ? "No documents match your search" : "No documents here yet"}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {search ? "Try a different name." : "Upload a file or create a folder to get organized."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
