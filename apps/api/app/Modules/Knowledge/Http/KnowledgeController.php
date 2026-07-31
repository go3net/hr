<?php

namespace App\Modules\Knowledge\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\KbArticle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class KnowledgeController extends ApiController
{
    /** Everyone reads published articles; editors also see drafts. */
    public function index(Request $request): JsonResponse
    {
        $isEditor = Gate::allows('permission', ['knowledge.manage']);

        $articles = KbArticle::query()
            ->with('author:id,name')
            ->when(! $isEditor, fn ($q) => $q->published())
            ->when($request->query('filter.category'), fn ($q, $c) => $q->where('category', $c))
            ->when($request->query('q'), function ($q, $term) {
                $q->where(fn ($w) => $w
                    ->where('title', 'like', "%{$term}%")
                    ->orWhere('body', 'like', "%{$term}%"));
            })
            ->orderByDesc('published_at')
            ->orderByDesc('updated_at')
            ->limit(100)
            ->get()
            ->map(fn (KbArticle $a) => $this->present($a));

        return $this->respond($articles, meta: ['is_editor' => $isEditor]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $isEditor = Gate::allows('permission', ['knowledge.manage']);

        $article = KbArticle::query()
            ->with('author:id,name')
            ->where('slug', $slug)
            ->when(! $isEditor, fn ($q) => $q->published())
            ->firstOrFail();

        // Fire-and-forget read counter; editors previewing don't inflate it.
        if ($article->status === 'published') {
            KbArticle::query()->whereKey($article->id)->increment('views');
        }

        return $this->respond([...$this->present($article), 'body' => $article->body]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('knowledge.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:60000'],
            'category' => ['nullable', 'in:'.implode(',', KbArticle::CATEGORIES)],
        ]);

        $article = KbArticle::create([
            ...$data,
            'slug' => KbArticle::slugFor($request->user()->tenant_id, $data['title']),
            'author_id' => $request->user()->id,
        ]);

        AuditLog::record('knowledge.article_created', $article, ['title' => $article->title]);

        return $this->respond($this->present($article), 201);
    }

    public function update(Request $request, KbArticle $article): JsonResponse
    {
        $this->requirePermission('knowledge.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'body' => ['sometimes', 'string', 'max:60000'],
            'category' => ['sometimes', 'nullable', 'in:'.implode(',', KbArticle::CATEGORIES)],
        ]);

        $article->update($data);

        return $this->respond([...$this->present($article), 'body' => $article->body]);
    }

    public function publish(Request $request, KbArticle $article): JsonResponse
    {
        $this->requirePermission('knowledge.manage');

        $article->update([
            'status' => 'published',
            'published_at' => $article->published_at ?? now(),
        ]);
        AuditLog::record('knowledge.article_published', $article);

        return $this->respond($this->present($article));
    }

    public function unpublish(Request $request, KbArticle $article): JsonResponse
    {
        $this->requirePermission('knowledge.manage');

        $article->update(['status' => 'draft']);

        return $this->respond($this->present($article));
    }

    public function destroy(Request $request, KbArticle $article): JsonResponse
    {
        $this->requirePermission('knowledge.manage');

        AuditLog::record('knowledge.article_deleted', $article, ['title' => $article->title]);
        $article->delete();

        return $this->respond(null, 204);
    }

    private function present(KbArticle $article): array
    {
        return [
            'id' => $article->id,
            'title' => $article->title,
            'slug' => $article->slug,
            'category' => $article->category,
            'status' => $article->status,
            'author' => $article->author?->name,
            'excerpt' => str(strip_tags($article->body))->limit(160)->toString(),
            'views' => $article->views,
            'published_at' => $article->published_at?->toIso8601String(),
            'updated_at' => $article->updated_at->toIso8601String(),
        ];
    }
}
