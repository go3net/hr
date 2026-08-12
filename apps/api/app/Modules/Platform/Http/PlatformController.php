<?php

namespace App\Modules\Platform\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\BillingPayment;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Go3net Office as a business: which companies use it, what they pay, whose
 * trial is about to lapse.
 *
 * Every query here is deliberately cross-tenant, which is why the whole
 * controller sits behind the platform-owner middleware. It reads account and
 * billing facts plus headcount — never a customer's employees, salaries,
 * documents or messages. Tenant isolation still protects those.
 */
class PlatformController extends ApiController
{
    private const PLANS = ['starter', 'growth', 'enterprise'];

    public function summary(): JsonResponse
    {
        $tenants = Tenant::query()->withoutGlobalScopes()->get(['id', 'status', 'trial_ends_at']);

        $paidThisMonth = BillingPayment::query()
            ->withoutGlobalScopes()
            ->where('status', 'paid')
            ->where('paid_at', '>=', now()->startOfMonth())
            ->sum('amount');

        $paidAllTime = BillingPayment::query()
            ->withoutGlobalScopes()
            ->where('status', 'paid')
            ->sum('amount');

        return $this->respond([
            'workspaces' => $tenants->count(),
            'active' => $tenants->where('status', 'active')->count(),
            'trialing' => $tenants->where('status', 'trial')->count(),
            'suspended' => $tenants->whereIn('status', ['suspended', 'cancelled'])->count(),
            // Trials worth chasing before they lapse.
            'trials_ending_soon' => $tenants
                ->where('status', 'trial')
                ->filter(fn ($t) => $t->trial_ends_at && $t->trial_ends_at->between(now(), now()->addDays(7)))
                ->count(),
            'expired_trials' => $tenants
                ->where('status', 'trial')
                ->filter(fn ($t) => $t->trial_ends_at && $t->trial_ends_at->isPast())
                ->count(),
            'revenue_this_month' => round((float) $paidThisMonth, 2),
            'revenue_all_time' => round((float) $paidAllTime, 2),
            'seats' => Employee::query()->withoutGlobalScopes()->where('status', '!=', 'exited')->count(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $status = $request->query('status');

        // Counts come from subqueries so one workspace with many staff cannot
        // slow the whole list down.
        $tenants = Tenant::query()
            ->withoutGlobalScopes()
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$search}%")
                ->orWhere('subdomain', 'like', "%{$search}%")))
            ->when($status, fn ($q, $s) => $q->where('status', $s))
            // The counted models carry the tenant scope, which would silently
            // narrow every subquery to the owner's own workspace and report
            // zero for everyone else. Drop it — the relation's own foreign key
            // is what ties each count to its row.
            ->withCount([
                'users as members_count' => fn ($q) => $q->withoutGlobalScopes(),
                'employees as headcount' => fn ($q) => $q->withoutGlobalScopes()->where('status', '!=', 'exited'),
            ])
            ->addSelect([
                'paid_total' => BillingPayment::query()
                    ->withoutGlobalScopes()
                    ->selectRaw('coalesce(sum(amount), 0)')
                    ->whereColumn('tenant_id', 'tenants.id')
                    ->where('status', 'paid'),
                'last_paid_at' => BillingPayment::query()
                    ->withoutGlobalScopes()
                    ->select('paid_at')
                    ->whereColumn('tenant_id', 'tenants.id')
                    ->where('status', 'paid')
                    ->latest('paid_at')
                    ->limit(1),
            ])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return $this->respond($tenants->map(fn (Tenant $t) => $this->present($t)));
    }

    public function show(string $publicId): JsonResponse
    {
        $tenant = $this->findTenant($publicId);

        $payments = BillingPayment::query()
            ->withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->latest('created_at')
            ->limit(20)
            ->get()
            ->map(fn (BillingPayment $p) => [
                'id' => $p->id,
                'plan_key' => $p->plan_key,
                'amount' => (float) $p->amount,
                'status' => $p->status,
                'channel' => $p->channel,
                'paid_at' => $p->paid_at?->toIso8601String(),
                'created_at' => $p->created_at->toIso8601String(),
            ]);

        // The owner's contact for this account — a name and email so support
        // can reach them. Not their staff list.
        $owner = User::query()
            ->withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereHas('roles', fn ($r) => $r->where('key', 'super_admin'))
            ->orderBy('id')
            ->first(['name', 'email', 'last_login_at']);

        return $this->respond($this->present($this->withCounts($tenant)) + [
            'payments' => $payments,
            'owner' => $owner ? [
                'name' => $owner->name,
                'email' => $owner->email,
                'last_login_at' => $owner->last_login_at?->toIso8601String(),
            ] : null,
        ]);
    }

    /** Suspend, reactivate, extend a trial or move a workspace between plans. */
    public function update(Request $request, string $publicId): JsonResponse
    {
        $tenant = $this->findTenant($publicId);

        $data = $request->validate([
            'status' => ['sometimes', 'in:trial,active,past_due,suspended,cancelled'],
            'plan_key' => ['sometimes', 'nullable', 'in:'.implode(',', self::PLANS)],
            'extend_trial_days' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'subscription_ends_at' => ['sometimes', 'nullable', 'date'],
        ]);

        $changes = collect($data)->except('extend_trial_days')->all();

        if (isset($data['extend_trial_days'])) {
            // Extend from whichever is later, so extending an expired trial
            // still gives the full window rather than landing in the past.
            $from = $tenant->trial_ends_at && $tenant->trial_ends_at->isFuture()
                ? $tenant->trial_ends_at
                : now();

            $changes['trial_ends_at'] = $from->copy()->addDays($data['extend_trial_days']);
            $changes['status'] ??= 'trial';
        }

        abort_if($changes === [], 422, 'Nothing to change.');

        $tenant->forceFill($changes)->save();

        AuditLog::record('platform.workspace.updated', $tenant, [
            'changes' => array_keys($changes),
            'by' => $request->user()->email,
        ]);

        return $this->respond($this->present($this->withCounts($tenant->fresh())));
    }

    private function findTenant(string $publicId): Tenant
    {
        return Tenant::query()->withoutGlobalScopes()->where('public_id', $publicId)->firstOrFail();
    }

    private function withCounts(Tenant $tenant): Tenant
    {
        $tenant->members_count = User::query()->withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)->count();
        $tenant->headcount = Employee::query()->withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)->where('status', '!=', 'exited')->count();
        $tenant->paid_total = (float) BillingPayment::query()->withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)->where('status', 'paid')->sum('amount');
        $tenant->last_paid_at = BillingPayment::query()->withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)->where('status', 'paid')
            ->latest('paid_at')->value('paid_at');

        return $tenant;
    }

    private function present(Tenant $t): array
    {
        $trialEnds = $t->trial_ends_at;

        return [
            'id' => $t->public_id,
            'name' => $t->name,
            'subdomain' => $t->subdomain,
            'status' => $t->status,
            'plan_key' => $t->plan_key,
            'trial_ends_at' => $trialEnds?->toDateString(),
            'trial_days_left' => $trialEnds ? (int) round(now()->diffInDays($trialEnds, false)) : null,
            'subscription_ends_at' => $t->subscription_ends_at?->toDateString(),
            'members_count' => (int) ($t->members_count ?? 0),
            'headcount' => (int) ($t->headcount ?? 0),
            'paid_total' => round((float) ($t->paid_total ?? 0), 2),
            'last_paid_at' => $t->last_paid_at
                ? \Illuminate\Support\Carbon::parse($t->last_paid_at)->toDateString()
                : null,
            'created_at' => $t->created_at->toDateString(),
        ];
    }

    /** New sign-ups over the last 12 months, for the console's chart. */
    public function signups(): JsonResponse
    {
        $rows = Tenant::query()
            ->withoutGlobalScopes()
            ->where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->get(['created_at'])
            ->groupBy(fn ($t) => $t->created_at->format('Y-m'));

        $series = collect(range(11, 0))->map(function (int $back) use ($rows) {
            $month = now()->subMonths($back);
            $key = $month->format('Y-m');

            return [
                'month' => $month->format('M'),
                'signups' => $rows->get($key)?->count() ?? 0,
            ];
        });

        return $this->respond($series->values());
    }
}
