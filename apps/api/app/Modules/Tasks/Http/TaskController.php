<?php

namespace App\Modules\Tasks\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TaskController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $tasks = Task::query()
            ->with(['assignees:id,name', 'project:id,name,color'])
            ->withCount('comments')
            ->whereNull('parent_id')
            ->when($request->query('filter.project_id'), fn ($q, $id) => $q->where('project_id', $id))
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->boolean('mine'), fn ($q) => $q->where(fn ($w) => $w
                ->whereHas('assignees', fn ($a) => $a->where('users.id', $request->user()->id))
                ->orWhere('created_by', $request->user()->id)))
            ->orderBy('status')
            ->orderBy('position')
            ->orderByDesc('created_at')
            ->limit(500)
            ->get();

        return $this->respond($tasks->map(fn (Task $t) => $this->present($t)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'parent_id' => ['nullable', 'integer', 'exists:tasks,id'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
            'status' => ['nullable', 'in:todo,in_progress,review,done'],
            'due_date' => ['nullable', 'date'],
            'assignee_ids' => ['array'],
            'assignee_ids.*' => ['integer'],
        ]);

        $status = $data['status'] ?? 'todo';

        $task = Task::create([
            ...collect($data)->except('assignee_ids')->all(),
            'status' => $status,
            'priority' => $data['priority'] ?? 'medium',
            'created_by' => $request->user()->id,
            'position' => $this->nextPosition($data['project_id'] ?? null, $status),
        ]);

        $assigneeIds = User::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereIn('id', $data['assignee_ids'] ?? [$request->user()->id])
            ->pluck('id');
        $task->assignees()->sync($assigneeIds);

        AuditLog::record('task.created', $task);

        return $this->respond($this->present($task->load(['assignees:id,name', 'project:id,name,color'])), 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $this->authorizeTask($request, $task);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'status' => ['sometimes', 'in:todo,in_progress,review,done'],
            'priority' => ['sometimes', 'in:low,medium,high,urgent'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer'],
        ]);

        if (($data['status'] ?? null) === 'done' && $task->status !== 'done') {
            $data['completed_at'] = now();
        }

        $task->update(collect($data)->except('assignee_ids')->all());

        if (array_key_exists('assignee_ids', $data)) {
            $assigneeIds = User::query()
                ->where('tenant_id', $request->user()->tenant_id)
                ->whereIn('id', $data['assignee_ids'])
                ->pluck('id');
            $task->assignees()->sync($assigneeIds);
        }

        AuditLog::record('task.updated', $task);

        return $this->respond($this->present($task->fresh(['assignees:id,name', 'project:id,name,color'])));
    }

    public function destroy(Request $request, Task $task): JsonResponse
    {
        $this->authorizeTask($request, $task);

        $task->delete();
        AuditLog::record('task.deleted', $task);

        return $this->respond(null, 204);
    }

    public function comments(Task $task): JsonResponse
    {
        return $this->respond(
            $task->comments()->with('author:id,name')->orderBy('created_at')->get()
                ->map(fn (TaskComment $c) => [
                    'id' => $c->id,
                    'author' => $c->author?->name,
                    'body' => $c->body,
                    'at' => $c->created_at->toIso8601String(),
                ]),
        );
    }

    public function addComment(Request $request, Task $task): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);

        $comment = $task->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        return $this->respond([
            'id' => $comment->id,
            'author' => $request->user()->name,
            'body' => $comment->body,
            'at' => $comment->created_at->toIso8601String(),
        ], 201);
    }

    /** Creator, assignee, or a projects manager may modify a task. */
    private function authorizeTask(Request $request, Task $task): void
    {
        $user = $request->user();

        $allowed = $task->created_by === $user->id
            || $task->assignees()->where('users.id', $user->id)->exists()
            || $user->hasPermission('projects.manage');

        if (! $allowed) {
            Gate::authorize('permission', ['projects.manage']); // consistent 403 shape
        }
    }

    private function nextPosition(?int $projectId, string $status): int
    {
        return (int) Task::query()
            ->where('project_id', $projectId)
            ->where('status', $status)
            ->max('position') + 1;
    }

    private function present(Task $t): array
    {
        return [
            'id' => $t->id,
            'title' => $t->title,
            'description' => $t->description,
            'status' => $t->status,
            'priority' => $t->priority,
            'due_date' => $t->due_date?->toDateString(),
            'position' => $t->position,
            'project' => $t->relationLoaded('project') && $t->project
                ? ['id' => $t->project->id, 'name' => $t->project->name, 'color' => $t->project->color]
                : null,
            'assignees' => $t->relationLoaded('assignees')
                ? $t->assignees->map(fn ($a) => ['id' => $a->id, 'name' => $a->name])
                : [],
            'comments_count' => $t->comments_count ?? 0,
            'completed_at' => $t->completed_at?->toIso8601String(),
        ];
    }
}
