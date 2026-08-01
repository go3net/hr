<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AssetAssignment;
use App\Models\AuditLog;
use App\Models\CompanyAsset;
use App\Models\Employee;
use App\Models\EmployeeExit;
use App\Models\ExitTask;
use App\Models\OnboardingTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LifecycleController extends ApiController
{
    private const DEFAULT_ONBOARDING = [
        'Sign employment contract and policies',
        'Collect NIN, BVN and bank details',
        'Provision laptop and accounts',
        'Add to payroll and pension',
        'Introduce team and assign onboarding buddy',
        'Book orientation session',
    ];

    private const DEFAULT_EXIT = [
        'Handover of active work and documents',
        'Return company assets',
        'Revoke system access and accounts',
        'Process final pay and entitlements',
        'Conduct exit interview',
    ];

    /* ── Onboarding ───────────────────────────────────────────── */

    public function onboarding(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        $tasks = OnboardingTask::query()
            ->where('employee_id', $employee->id)
            ->orderBy('position')
            ->with('assignee:id,name')
            ->get();

        $done = $tasks->where('status', 'done')->count();

        return $this->respond([
            'employee' => $employee->full_name,
            'progress' => $tasks->count() > 0 ? (int) round($done / $tasks->count() * 100) : 0,
            'tasks' => $tasks->map(fn (OnboardingTask $task) => $this->presentTask($task)),
        ]);
    }

    /** Everyone currently onboarding (has pending tasks). */
    public function onboardingIndex(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        $rows = OnboardingTask::query()
            ->selectRaw('employee_id, count(*) as total, sum(case when status = ? then 1 else 0 end) as done', ['done'])
            ->groupBy('employee_id')
            ->get();

        $employees = Employee::query()
            ->whereIn('id', $rows->pluck('employee_id'))
            ->get()
            ->keyBy('id');

        return $this->respond(
            $rows->map(fn ($row) => [
                'employee_id' => $row->employee_id,
                'employee' => $employees->get($row->employee_id)?->full_name,
                'public_id' => $employees->get($row->employee_id)?->public_id,
                'total' => (int) $row->total,
                'done' => (int) $row->done,
                'progress' => (int) round($row->done / max(1, $row->total) * 100),
            ])->sortBy('progress')->values(),
        );
    }

    public function startOnboarding(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        if (OnboardingTask::query()->where('employee_id', $employee->id)->exists()) {
            return $this->respondError('VALIDATION', 'Onboarding is already running for this employee.', 422);
        }

        foreach (self::DEFAULT_ONBOARDING as $i => $title) {
            OnboardingTask::create([
                'employee_id' => $employee->id,
                'title' => $title,
                'position' => $i + 1,
            ]);
        }

        AuditLog::record('hr.onboarding_started', $employee);

        return $this->onboarding($request, $employee)->setStatusCode(201);
    }

    public function addOnboardingTask(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'assigned_to' => ['nullable', 'integer'],
            'due_date' => ['nullable', 'date'],
        ]);

        $task = OnboardingTask::create([
            ...$data,
            'employee_id' => $employee->id,
            'position' => (OnboardingTask::query()->where('employee_id', $employee->id)->max('position') ?? 0) + 1,
        ]);

        return $this->respond($this->presentTask($task), 201);
    }

    public function toggleOnboardingTask(Request $request, OnboardingTask $task): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $done = $task->status !== 'done';
        $task->update(['status' => $done ? 'done' : 'pending', 'completed_at' => $done ? now() : null]);

        return $this->respond($this->presentTask($task));
    }

    /* ── Assets ───────────────────────────────────────────────── */

    public function assets(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        $assets = CompanyAsset::query()
            ->with('assignedEmployee:id,first_name,last_name')
            ->when($request->query('q'), function ($query, $q) {
                $query->where(fn ($w) => $w
                    ->where('name', 'like', "%{$q}%")
                    ->orWhere('tag', 'like', "%{$q}%")
                    ->orWhere('serial_number', 'like', "%{$q}%"));
            })
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->orderBy('tag')
            ->limit(300)
            ->get();

        return $this->respond(
            $assets->map(fn (CompanyAsset $asset) => $this->presentAsset($asset)),
            meta: [
                'total' => CompanyAsset::query()->count(),
                'assigned' => CompanyAsset::query()->where('status', 'assigned')->count(),
                'available' => CompanyAsset::query()->where('status', 'available')->count(),
            ],
        );
    }

    public function storeAsset(Request $request): JsonResponse
    {
        $this->requirePermission('hr.assets.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'tag' => ['required', 'string', 'max:60'],
            'category' => ['nullable', 'in:'.implode(',', CompanyAsset::CATEGORIES)],
            'serial_number' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:300'],
        ]);

        if (CompanyAsset::query()->where('tag', $data['tag'])->exists()) {
            return $this->respondError('VALIDATION', 'An asset with this tag already exists.', 422);
        }

        $asset = CompanyAsset::create($data);
        AuditLog::record('hr.asset_created', $asset, ['tag' => $asset->tag]);

        return $this->respond($this->presentAsset($asset), 201);
    }

    public function updateAsset(Request $request, CompanyAsset $asset): JsonResponse
    {
        $this->requirePermission('hr.assets.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'category' => ['sometimes', 'in:'.implode(',', CompanyAsset::CATEGORIES)],
            'serial_number' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'in:available,maintenance,retired'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:300'],
        ]);

        // Status can only be restated while unassigned; assignment owns 'assigned'.
        if (isset($data['status']) && $asset->status === 'assigned') {
            return $this->respondError('VALIDATION', 'Return the asset before changing its status.', 422);
        }

        $asset->update($data);

        return $this->respond($this->presentAsset($asset->fresh('assignedEmployee:id,first_name,last_name')));
    }

    public function assignAsset(Request $request, CompanyAsset $asset): JsonResponse
    {
        $this->requirePermission('hr.assets.manage');

        $data = $request->validate(['employee_id' => ['required', 'integer']]);

        if ($asset->status !== 'available') {
            return $this->respondError('VALIDATION', 'This asset is not available for assignment.', 422);
        }

        $employee = Employee::query()->find($data['employee_id']);
        if (! $employee) {
            return $this->respondError('VALIDATION', 'Employee not found.', 422);
        }

        DB::transaction(function () use ($asset, $employee) {
            $asset->update([
                'status' => 'assigned',
                'assigned_employee_id' => $employee->id,
                'assigned_at' => now(),
            ]);
            AssetAssignment::create([
                'company_asset_id' => $asset->id,
                'employee_id' => $employee->id,
                'assigned_at' => now(),
            ]);
        });

        AuditLog::record('hr.asset_assigned', $asset, ['employee' => $employee->full_name]);

        return $this->respond($this->presentAsset($asset->fresh('assignedEmployee:id,first_name,last_name')));
    }

    public function returnAsset(Request $request, CompanyAsset $asset): JsonResponse
    {
        $this->requirePermission('hr.assets.manage');

        $data = $request->validate(['condition_note' => ['nullable', 'string', 'max:300']]);

        if ($asset->status !== 'assigned') {
            return $this->respondError('VALIDATION', 'This asset is not currently assigned.', 422);
        }

        DB::transaction(function () use ($asset, $data) {
            AssetAssignment::query()
                ->where('company_asset_id', $asset->id)
                ->whereNull('returned_at')
                ->latest('assigned_at')
                ->first()
                ?->update(['returned_at' => now(), 'condition_note' => $data['condition_note'] ?? null]);

            $asset->update([
                'status' => 'available',
                'assigned_employee_id' => null,
                'assigned_at' => null,
            ]);
        });

        return $this->respond($this->presentAsset($asset->fresh()));
    }

    public function assetHistory(Request $request, CompanyAsset $asset): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        return $this->respond(
            $asset->assignments()
                ->with('employee:id,first_name,last_name')
                ->orderByDesc('assigned_at')
                ->limit(50)
                ->get()
                ->map(fn (AssetAssignment $a) => [
                    'id' => $a->id,
                    'employee' => $a->employee ? "{$a->employee->first_name} {$a->employee->last_name}" : null,
                    'assigned_at' => $a->assigned_at->toIso8601String(),
                    'returned_at' => $a->returned_at?->toIso8601String(),
                    'condition_note' => $a->condition_note,
                ]),
        );
    }

    /* ── Exits ────────────────────────────────────────────────── */

    public function exits(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        return $this->respond(
            EmployeeExit::query()
                ->with(['employee:id,first_name,last_name', 'tasks'])
                ->orderByDesc('created_at')
                ->limit(100)
                ->get()
                ->map(fn (EmployeeExit $exit) => $this->presentExit($exit)),
        );
    }

    public function initiateExit(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $data = $request->validate([
            'reason' => ['required', 'in:'.implode(',', EmployeeExit::REASONS)],
            'notice_date' => ['nullable', 'date'],
            'last_working_day' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        if (EmployeeExit::query()->where('employee_id', $employee->id)->where('status', 'clearance')->exists()) {
            return $this->respondError('VALIDATION', 'An exit is already in progress for this employee.', 422);
        }

        $exit = DB::transaction(function () use ($employee, $data, $request) {
            $exit = EmployeeExit::create([
                ...$data,
                'employee_id' => $employee->id,
                'initiated_by' => $request->user()->id,
            ]);
            foreach (self::DEFAULT_EXIT as $i => $title) {
                ExitTask::create(['exit_id' => $exit->id, 'title' => $title, 'position' => $i + 1]);
            }

            return $exit;
        });

        AuditLog::record('hr.exit_initiated', $exit, ['reason' => $exit->reason]);

        return $this->respond($this->presentExit($exit->load(['employee:id,first_name,last_name', 'tasks'])), 201);
    }

    public function toggleExitTask(Request $request, ExitTask $task): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        if ($task->exit->status !== 'clearance') {
            return $this->respondError('VALIDATION', 'This exit is no longer in clearance.', 422);
        }

        $done = $task->status !== 'done';
        $task->update(['status' => $done ? 'done' : 'pending', 'completed_at' => $done ? now() : null]);

        return $this->respond($this->presentExit($task->exit->fresh(['employee:id,first_name,last_name', 'tasks'])));
    }

    /** All clearance tasks done + no assets out → employee becomes exited. */
    public function completeExit(Request $request, EmployeeExit $exit): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        if ($exit->status !== 'clearance') {
            return $this->respondError('VALIDATION', 'This exit is not in clearance.', 422);
        }
        if ($exit->tasks()->where('status', '!=', 'done')->exists()) {
            return $this->respondError('VALIDATION', 'Complete every clearance task first.', 422);
        }
        $assetsOut = CompanyAsset::query()->where('assigned_employee_id', $exit->employee_id)->count();
        if ($assetsOut > 0) {
            return $this->respondError(
                'VALIDATION',
                "The employee still holds {$assetsOut} company asset".($assetsOut === 1 ? '' : 's').' — return them first.',
                422,
            );
        }

        DB::transaction(function () use ($exit) {
            $exit->update(['status' => 'completed', 'completed_at' => now()]);
            $exit->employee->update(['status' => 'exited']);
        });

        AuditLog::record('hr.exit_completed', $exit);

        return $this->respond($this->presentExit($exit->fresh(['employee:id,first_name,last_name', 'tasks'])));
    }

    public function cancelExit(Request $request, EmployeeExit $exit): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        if ($exit->status !== 'clearance') {
            return $this->respondError('VALIDATION', 'Only an in-progress exit can be cancelled.', 422);
        }

        $exit->update(['status' => 'cancelled']);

        return $this->respond($this->presentExit($exit->fresh(['employee:id,first_name,last_name', 'tasks'])));
    }

    /* ── Presenters ───────────────────────────────────────────── */

    private function presentTask(OnboardingTask $task): array
    {
        return [
            'id' => $task->id,
            'title' => $task->title,
            'status' => $task->status,
            'assignee' => $task->assignee?->name,
            'due_date' => $task->due_date?->toDateString(),
            'completed_at' => $task->completed_at?->toIso8601String(),
        ];
    }

    private function presentAsset(CompanyAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'name' => $asset->name,
            'tag' => $asset->tag,
            'category' => $asset->category,
            'serial_number' => $asset->serial_number,
            'status' => $asset->status,
            'assigned_to' => $asset->assignedEmployee
                ? "{$asset->assignedEmployee->first_name} {$asset->assignedEmployee->last_name}"
                : null,
            'assigned_employee_id' => $asset->assigned_employee_id,
            'assigned_at' => $asset->assigned_at?->toIso8601String(),
            'notes' => $asset->notes,
        ];
    }

    private function presentExit(EmployeeExit $exit): array
    {
        $tasks = $exit->tasks;
        $done = $tasks->where('status', 'done')->count();

        return [
            'id' => $exit->id,
            'employee' => $exit->employee
                ? "{$exit->employee->first_name} {$exit->employee->last_name}"
                : null,
            'employee_id' => $exit->employee_id,
            'reason' => $exit->reason,
            'notice_date' => $exit->notice_date?->toDateString(),
            'last_working_day' => $exit->last_working_day->toDateString(),
            'status' => $exit->status,
            'notes' => $exit->notes,
            'progress' => $tasks->count() > 0 ? (int) round($done / $tasks->count() * 100) : 0,
            'tasks' => $tasks->map(fn (ExitTask $task) => [
                'id' => $task->id,
                'title' => $task->title,
                'status' => $task->status,
            ])->values(),
            'created_at' => $exit->created_at->toIso8601String(),
        ];
    }
}
