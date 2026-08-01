<?php

namespace App\Modules\Projects\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->requirePermission('projects.view');

        $projects = Project::query()
            ->with('members:id,name')
            ->withCount([
                'tasks',
                'tasks as done_tasks_count' => fn ($q) => $q->where('status', 'done'),
            ])
            ->orderByDesc('created_at')
            ->get();

        return $this->respond($projects->map(fn (Project $p) => $this->present($p)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('projects.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:5000'],
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'starts_on' => ['nullable', 'date'],
            'due_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'member_ids' => ['array'],
            'member_ids.*' => ['integer'],
        ]);

        $project = Project::create([
            ...collect($data)->except('member_ids')->all(),
            'created_by' => $request->user()->id,
        ]);

        // Creator + any listed members (validated against this tenant's users).
        $memberIds = User::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereIn('id', [...($data['member_ids'] ?? []), $request->user()->id])
            ->pluck('id');
        $project->members()->sync($memberIds);

        AuditLog::record('project.created', $project);

        return $this->respond($this->present($project->load('members:id,name')->loadCount('tasks')), 201);
    }

    public function show(Project $project): JsonResponse
    {
        $this->requirePermission('projects.view');

        $project->load(['members:id,name', 'milestones'])
            ->loadCount(['tasks', 'tasks as done_tasks_count' => fn ($q) => $q->where('status', 'done')]);

        return $this->respond($this->present($project) + [
            'description' => $project->description,
            'milestones' => $project->milestones->map(fn ($m) => [
                'id' => $m->id,
                'name' => $m->name,
                'due_on' => $m->due_on?->toDateString(),
                'is_completed' => $m->is_completed,
            ]),
        ]);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $this->requirePermission('projects.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'in:active,on_hold,completed,archived'],
            'color' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'starts_on' => ['sometimes', 'nullable', 'date'],
            'due_on' => ['sometimes', 'nullable', 'date'],
            'budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        $project->update($data);
        AuditLog::record('project.updated', $project);

        return $this->respond($this->present($project->load('members:id,name')->loadCount('tasks')));
    }

    public function destroy(Project $project): JsonResponse
    {
        $this->requirePermission('projects.manage');

        $project->delete();
        AuditLog::record('project.deleted', $project);

        return $this->respond(null, 204);
    }

    private function present(Project $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'status' => $p->status,
            'color' => $p->color,
            'starts_on' => $p->starts_on?->toDateString(),
            'due_on' => $p->due_on?->toDateString(),
            'budget' => $p->budget !== null ? (float) $p->budget : null,
            'tasks_count' => $p->tasks_count ?? 0,
            'done_tasks_count' => $p->done_tasks_count ?? 0,
            'members' => $p->relationLoaded('members')
                ? $p->members->map(fn ($m) => ['id' => $m->id, 'name' => $m->name])
                : [],
        ];
    }
}
