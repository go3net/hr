<?php

namespace App\Modules\Documents\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Folder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class DocumentController extends ApiController
{
    /** Folder contents: subfolders + documents visible to the caller. */
    public function index(Request $request): JsonResponse
    {
        $folderId = $request->query('folder_id');
        $q = $request->query('q');

        $folders = Folder::query()
            ->when(! $q, fn ($query) => $query->where('parent_id', $folderId))
            ->when($q, fn ($query) => $query->where('name', 'like', "%{$q}%"))
            ->withCount(['children', 'documents'])
            ->orderBy('name')
            ->get()
            ->map(fn (Folder $f) => [
                'id' => $f->id,
                'name' => $f->name,
                'parent_id' => $f->parent_id,
                'items' => $f->children_count + $f->documents_count,
            ]);

        $documents = Document::query()
            ->visibleTo($request->user())
            ->with('uploader:id,name')
            ->when(! $q, fn ($query) => $query->where('folder_id', $folderId))
            ->when($q, fn ($query) => $query->where('name', 'like', "%{$q}%"))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (Document $d) => $this->present($d));

        // Breadcrumb for the current folder.
        $crumbs = [];
        if ($folderId && ($current = Folder::query()->find($folderId))) {
            $node = $current;
            while ($node) {
                array_unshift($crumbs, ['id' => $node->id, 'name' => $node->name]);
                $node = $node->parent;
            }
        }

        return $this->respond([
            'folders' => $folders,
            'documents' => $documents,
            'breadcrumbs' => $crumbs,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25 MB
            'folder_id' => ['nullable', 'integer', 'exists:folders,id'],
            'visibility' => ['nullable', 'in:tenant,private'],
        ]);

        $file = $data['file'];
        $tenantId = $request->user()->tenant_id;
        $path = $file->store("tenants/{$tenantId}/documents");

        $document = Document::create([
            'folder_id' => $data['folder_id'] ?? null,
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'mime' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
            'visibility' => $data['visibility'] ?? 'tenant',
            'uploaded_by' => $request->user()->id,
        ]);

        AuditLog::record('document.uploaded', $document);

        return $this->respond($this->present($document->load('uploader:id,name')), 201);
    }

    public function download(Request $request, Document $document): Response
    {
        abort_unless($document->isAccessibleBy($request->user()), 404);

        return Storage::download($document->path, $document->name, [
            'Content-Type' => $document->mime ?? 'application/octet-stream',
        ]);
    }

    public function update(Request $request, Document $document): JsonResponse
    {
        $this->authorizeOwnerOrManager($request, $document);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'folder_id' => ['sometimes', 'nullable', 'integer', 'exists:folders,id'],
            'visibility' => ['sometimes', 'in:tenant,private'],
        ]);

        $document->update($data);

        return $this->respond($this->present($document->fresh('uploader:id,name')));
    }

    public function destroy(Request $request, Document $document): JsonResponse
    {
        $this->authorizeOwnerOrManager($request, $document);

        Storage::delete($document->path);
        $document->delete();
        AuditLog::record('document.deleted', $document);

        return $this->respond(null, 204);
    }

    /** Grant named users access to a private document. */
    public function share(Request $request, Document $document): JsonResponse
    {
        $this->authorizeOwnerOrManager($request, $document);

        $data = $request->validate([
            'user_ids' => ['required', 'array'],
            'user_ids.*' => ['integer'],
        ]);

        $ids = User::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereIn('id', $data['user_ids'])
            ->pluck('id');

        $document->sharedWith()->sync($ids);
        AuditLog::record('document.shared', $document);

        return $this->respond([
            'shared_with' => $document->sharedWith()->get(['users.id', 'name'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]),
        ]);
    }

    private function authorizeOwnerOrManager(Request $request, Document $document): void
    {
        $user = $request->user();
        abort_unless(
            $document->uploaded_by === $user->id || $user->hasPermission('documents.manage'),
            403,
            'Only the uploader or a documents manager can do that.',
        );
    }

    private function present(Document $d): array
    {
        return [
            'id' => $d->id,
            'name' => $d->name,
            'folder_id' => $d->folder_id,
            'mime' => $d->mime,
            'size_bytes' => (int) $d->size_bytes,
            'visibility' => $d->visibility,
            'uploaded_by' => $d->relationLoaded('uploader') ? $d->uploader?->name : null,
            'created_at' => $d->created_at->toIso8601String(),
        ];
    }
}
