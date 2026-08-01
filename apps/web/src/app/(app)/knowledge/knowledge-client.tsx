"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen, Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  type ArticleDetail,
  type ArticleRow,
  useArticle,
  useArticles,
  useDeleteArticle,
  useSaveArticle,
  useSetArticlePublished,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  policies: "Policies",
  how_to: "How-to",
  onboarding: "Onboarding",
  it: "IT",
  benefits: "Benefits",
  other: "Other",
};

function EditorDialog({
  open,
  onOpenChange,
  article,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: ArticleDetail | null;
}) {
  const save = useSaveArticle();
  const [title, setTitle] = useState(article?.title ?? "");
  const [category, setCategory] = useState(article?.category ?? "how_to");
  const [body, setBody] = useState(article?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    save.mutate(
      { id: article?.id, title, category, body },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the article."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={article ? "Edit article" : "New article"}
        description="Write in Markdown — headings, lists and links all work."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="a-title">Title</Label>
            <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual leave policy" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="a-category">Category</Label>
            <Select id="a-category" value={category ?? "other"} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="a-body">Content</Label>
            <textarea
              id="a-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 font-mono text-[13px] text-foreground shadow-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={save.isPending || title.trim() === "" || body.trim() === ""}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save {article ? "changes" : "draft"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Reader({
  slug,
  isEditor,
  onBack,
}: {
  slug: string;
  isEditor: boolean;
  onBack: () => void;
}) {
  const { data: article, isLoading } = useArticle(slug);
  const setPublished = useSetArticlePublished();
  const deleteArticle = useDeleteArticle();
  const [editing, setEditing] = useState(false);

  if (isLoading || !article) {
    return (
      <Card className="space-y-3 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          All articles
        </Button>
        {isEditor ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPublished.mutate({ id: article.id, publish: article.status !== "published" })}
              disabled={setPublished.isPending}
            >
              {article.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={() => {
                if (window.confirm("Delete this article? This cannot be undone.")) {
                  deleteArticle.mutate(article.id, { onSuccess: onBack });
                }
              }}
              disabled={deleteArticle.isPending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {article.category ? <Badge variant="primary">{CATEGORY_LABELS[article.category] ?? article.category}</Badge> : null}
          {article.status === "draft" ? <Badge variant="warning">Draft</Badge> : null}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{article.title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {article.author ? `By ${article.author} · ` : ""}
          {article.views} view{article.views === 1 ? "" : "s"}
          {article.published_at
            ? ` · Published ${new Date(article.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
            : ""}
        </p>
        <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {article.body}
        </div>
      </Card>

      {editing ? <EditorDialog open={editing} onOpenChange={setEditing} article={article} /> : null}
    </div>
  );
}

export function KnowledgeClient() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useArticles(search);

  const articles = data?.articles ?? [];
  const isEditor = data?.isEditor ?? false;

  if (selected) {
    return <Reader slug={selected} isEditor={isEditor} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Knowledge base</h1>
          <p className="text-sm text-muted-foreground">Policies, how-tos and guides for the whole team.</p>
        </div>
        {isEditor ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New article
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : articles.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search
              ? "No articles match that search."
              : isEditor
                ? "No articles yet — write the first one."
                : "No articles published yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article: ArticleRow) => (
            <button
              key={article.id}
              type="button"
              onClick={() => setSelected(article.slug)}
              className="flex flex-col rounded-[14px] border border-border bg-surface p-5 text-left shadow-card transition hover:border-primary/40 hover:shadow-pop"
            >
              <div className="flex items-center gap-2">
                {article.category ? (
                  <Badge variant="primary">{CATEGORY_LABELS[article.category] ?? article.category}</Badge>
                ) : null}
                {article.status === "draft" ? <Badge variant="warning">Draft</Badge> : null}
              </div>
              <h3 className="mt-2.5 text-[15px] font-semibold text-foreground">{article.title}</h3>
              <p className="mt-1 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {article.excerpt}
              </p>
              <p className="mt-3 flex items-center gap-1 text-[12px] text-muted-foreground">
                <Eye className="size-3.5" />
                {article.views}
                {article.author ? <span className="ml-2">{article.author}</span> : null}
              </p>
            </button>
          ))}
        </div>
      )}

      {creating ? <EditorDialog open={creating} onOpenChange={setCreating} article={null} /> : null}
    </div>
  );
}
