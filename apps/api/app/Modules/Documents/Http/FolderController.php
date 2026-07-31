<?php

namespace App\Modules\Documents\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Folder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FolderController extends ApiController
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'parent_id' => ['nullable', 'integer', 'exists:folders,id'],
        ]);

        $folder = Folder::create([...$data, 'created_by' => $request->user()->id]);
        AuditLog::record('folder.created', $folder);

        return $this->respond([
            'id' => $folder->id,
            'name' => $folder->name,
            'parent_id' => $folder->parent_id,
            'items' => 0,
        ], 201);
    }

    public function update(Request $request, Folder $folder): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:160']]);
        $folder->update($data);

        return $this->respond($folder->only(['id', 'name', 'parent_id']));
    }

    public function destroy(Request $request, Folder $folder): JsonResponse
    {
        if ($folder->children()->exists() || $folder->documents()->exists()) {
            return $this->respondError('FOLDER_NOT_EMPTY', 'Empty the folder before deleting it.', 422);
        }

        $folder->delete();
        AuditLog::record('folder.deleted', $folder);

        return $this->respond(null, 204);
    }
}
