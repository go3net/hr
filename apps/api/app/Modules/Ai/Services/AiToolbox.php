<?php

namespace App\Modules\Ai\Services;

use App\Models\AttendanceRecord;
use App\Models\Deal;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\KbArticle;
use App\Models\LeaveRequest;
use App\Models\Project;
use App\Models\Task;
use App\Models\Transaction;
use App\Models\User;

/**
 * The allowlisted tools Claude may call during a chat turn. Every tool runs
 * tenant-scoped Eloquent queries (global scopes apply), is gated by the same
 * permission the equivalent screen requires, and returns only non-sensitive
 * fields — never salaries, bank details or identity numbers.
 */
class AiToolbox
{
    /** @return array<int, array{name: string, description: string, input_schema: array, permission: string, module: string}> */
    private function catalog(): array
    {
        return [
            [
                'name' => 'search_employees',
                'description' => 'Search the employee directory by name, department or status. Returns name, position, department, employment type and status — never salary or identity data.',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Name fragment to search for. Omit to list everyone.'],
                        'status' => ['type' => 'string', 'enum' => ['active', 'on_leave', 'suspended', 'exited'], 'description' => 'Filter by employment status.'],
                    ],
                ],
                'permission' => 'hr.employees.view',
                'module' => 'hr',
            ],
            [
                'name' => 'get_leave_summary',
                'description' => 'Who is on approved leave today, plus pending leave requests awaiting a decision.',
                'input_schema' => ['type' => 'object', 'properties' => new \stdClass],
                'permission' => 'hr.leave.view',
                'module' => 'hr',
            ],
            [
                'name' => 'get_attendance_today',
                'description' => "Today's attendance: who clocked in, who was late, and who has not shown up.",
                'input_schema' => ['type' => 'object', 'properties' => new \stdClass],
                'permission' => 'hr.attendance.view',
                'module' => 'hr',
            ],
            [
                'name' => 'get_project_status',
                'description' => 'Active projects with their open and completed task counts.',
                'input_schema' => ['type' => 'object', 'properties' => new \stdClass],
                'permission' => 'projects.view',
                'module' => 'projects',
            ],
            [
                'name' => 'get_deal_pipeline',
                'description' => 'CRM deal pipeline: count and total value per stage, and deals expected to close soon.',
                'input_schema' => ['type' => 'object', 'properties' => new \stdClass],
                'permission' => 'crm.view',
                'module' => 'crm',
            ],
            [
                'name' => 'get_finance_summary',
                'description' => "This month's approved income, expenses and net, pending expense approvals, and outstanding invoices.",
                'input_schema' => ['type' => 'object', 'properties' => new \stdClass],
                'permission' => 'finance.view',
                'module' => 'finance',
            ],
            [
                'name' => 'search_knowledge_base',
                'description' => 'Search the company knowledge base (policies, how-tos, onboarding guides) and read matching articles.',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Words to search for in article titles and bodies.'],
                    ],
                    'required' => ['query'],
                ],
                'permission' => null, // published articles are readable by all staff
                'module' => 'knowledge',
            ],
        ];
    }

    /**
     * Tool definitions this user may call, shaped for the Messages API.
     *
     * @return array<int, array{name: string, description: string, input_schema: array}>
     */
    public function definitionsFor(User $user): array
    {
        $tenant = $user->tenant;

        return collect($this->catalog())
            ->filter(fn (array $tool) => ($tool['permission'] === null || $user->hasPermission($tool['permission']))
                && $tenant->hasModuleEnabled($tool['module']))
            ->map(fn (array $tool) => [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'input_schema' => $tool['input_schema'],
            ])
            ->values()
            ->all();
    }

    /** Execute a tool call. Returns a JSON-encodable result, or an error string. */
    public function execute(User $user, string $name, array $input): array|string
    {
        $allowed = collect($this->definitionsFor($user))->pluck('name');
        if (! $allowed->contains($name)) {
            return "Tool {$name} is not available to this user.";
        }

        return match ($name) {
            'search_employees' => $this->searchEmployees($input),
            'get_leave_summary' => $this->leaveSummary(),
            'get_attendance_today' => $this->attendanceToday(),
            'get_project_status' => $this->projectStatus(),
            'get_deal_pipeline' => $this->dealPipeline(),
            'get_finance_summary' => $this->financeSummary(),
            'search_knowledge_base' => $this->searchKnowledgeBase($input),
            default => "Unknown tool {$name}.",
        };
    }

    private function searchEmployees(array $input): array
    {
        $employees = Employee::query()
            ->with(['department:id,name', 'position:id,title'])
            ->when($input['query'] ?? null, function ($q, $term) {
                $q->where(fn ($w) => $w
                    ->where('first_name', 'like', "%{$term}%")
                    ->orWhere('last_name', 'like', "%{$term}%")
                    ->orWhere('employee_code', 'like', "%{$term}%"));
            })
            ->when($input['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderBy('first_name')
            ->limit(25)
            ->get();

        return [
            'count' => $employees->count(),
            'employees' => $employees->map(fn (Employee $e) => [
                'name' => "{$e->first_name} {$e->last_name}",
                'code' => $e->employee_code,
                'position' => $e->position?->title,
                'department' => $e->department?->name,
                'employment_type' => $e->employment_type,
                'status' => $e->status,
                'hired_at' => $e->hired_at?->toDateString(),
            ])->all(),
        ];
    }

    private function leaveSummary(): array
    {
        $today = now()->toDateString();

        $onLeave = LeaveRequest::query()
            ->with(['employee:id,first_name,last_name', 'leaveType:id,name'])
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->get()
            ->map(fn (LeaveRequest $r) => [
                'employee' => "{$r->employee->first_name} {$r->employee->last_name}",
                'type' => $r->leaveType->name,
                'until' => $r->end_date->toDateString(),
            ]);

        $pending = LeaveRequest::query()
            ->with(['employee:id,first_name,last_name', 'leaveType:id,name'])
            ->where('status', 'pending')
            ->orderBy('start_date')
            ->limit(20)
            ->get()
            ->map(fn (LeaveRequest $r) => [
                'employee' => "{$r->employee->first_name} {$r->employee->last_name}",
                'type' => $r->leaveType->name,
                'from' => $r->start_date->toDateString(),
                'to' => $r->end_date->toDateString(),
                'days' => (float) $r->days,
            ]);

        return ['on_leave_today' => $onLeave->all(), 'pending_requests' => $pending->all()];
    }

    private function attendanceToday(): array
    {
        $records = AttendanceRecord::query()
            ->with('employee:id,first_name,last_name')
            ->whereDate('work_date', now()->toDateString())
            ->get();

        $activeCount = Employee::query()->where('status', 'active')->count();

        return [
            'active_employees' => $activeCount,
            'clocked_in' => $records->count(),
            'late' => $records->where('is_late', true)
                ->map(fn (AttendanceRecord $r) => [
                    'employee' => "{$r->employee->first_name} {$r->employee->last_name}",
                    'minutes_late' => $r->minutes_late,
                ])->values()->all(),
            'not_clocked_in' => max(0, $activeCount - $records->count()),
        ];
    }

    private function projectStatus(): array
    {
        $projects = Project::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->limit(20)
            ->get()
            ->map(function (Project $p) {
                $tasks = Task::query()->where('project_id', $p->id)->get(['status']);

                return [
                    'name' => $p->name,
                    'status' => $p->status,
                    'open_tasks' => $tasks->whereNotIn('status', ['done'])->count(),
                    'done_tasks' => $tasks->where('status', 'done')->count(),
                ];
            });

        return ['active_projects' => $projects->all()];
    }

    private function dealPipeline(): array
    {
        $deals = Deal::query()->with('client:id,name')->get();

        $stages = collect(Deal::STAGES)->map(fn (string $stage) => [
            'stage' => $stage,
            'count' => $deals->where('stage', $stage)->count(),
            'total_value' => (float) $deals->where('stage', $stage)->sum('value'),
        ]);

        $closingSoon = $deals
            ->whereNotIn('stage', ['won', 'lost'])
            ->filter(fn (Deal $d) => $d->expected_close && $d->expected_close->lte(now()->addDays(30)))
            ->map(fn (Deal $d) => [
                'title' => $d->title,
                'client' => $d->client?->name,
                'stage' => $d->stage,
                'value' => (float) $d->value,
                'expected_close' => $d->expected_close->toDateString(),
            ])->values();

        return ['pipeline' => $stages->all(), 'closing_within_30_days' => $closingSoon->all()];
    }

    private function financeSummary(): array
    {
        $monthStart = now()->startOfMonth()->toDateString();

        $approved = Transaction::query()
            ->where('status', 'approved')
            ->whereDate('occurred_on', '>=', $monthStart)
            ->get(['kind', 'amount']);

        $income = (float) $approved->where('kind', 'income')->sum('amount');
        $expenses = (float) $approved->where('kind', 'expense')->sum('amount');

        $outstanding = Invoice::query()
            ->whereIn('status', ['sent', 'partial', 'overdue'])
            ->get(['number', 'total', 'due_date'])
            ->map(fn (Invoice $i) => [
                'number' => $i->number,
                'total' => (float) $i->total,
                'due_date' => $i->due_date?->toDateString(),
            ]);

        return [
            'month' => now()->format('F Y'),
            'income' => $income,
            'expenses' => $expenses,
            'net' => $income - $expenses,
            'pending_expense_approvals' => Transaction::query()->where('status', 'pending')->count(),
            'outstanding_invoices' => $outstanding->all(),
        ];
    }

    private function searchKnowledgeBase(array $input): array
    {
        $term = trim((string) ($input['query'] ?? ''));

        $articles = KbArticle::query()
            ->published()
            ->when($term !== '', function ($q) use ($term) {
                $q->where(fn ($w) => $w
                    ->where('title', 'like', "%{$term}%")
                    ->orWhere('body', 'like', "%{$term}%"));
            })
            ->orderByDesc('published_at')
            ->limit(5)
            ->get();

        return [
            'count' => $articles->count(),
            'articles' => $articles->map(fn (KbArticle $a) => [
                'title' => $a->title,
                'category' => $a->category,
                'body' => str($a->body)->limit(2000)->toString(),
            ])->all(),
        ];
    }
}
