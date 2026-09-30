<?php

namespace App\Modules\Settings\Http;

use App\Core\Http\ApiController;
use App\Core\Notifications\PasswordReset as PasswordResetNotification;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

/**
 * Getting people back into their accounts.
 *
 * With no mail configured, a reset link that only arrives by email helps
 * nobody, so both routes here hand the result back to the administrator to
 * pass on: a link the person opens themselves, or a password set for them
 * when that is the only thing that will work.
 */
class AccountAccessController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');
        $tenant = app(TenantContext::class)->get();

        $members = User::query()
            ->where('tenant_id', $tenant->id)
            ->with(['roles:id,key,name', 'employee:id,user_id,employee_code'])
            ->orderBy('name')
            ->limit(300)
            ->get();

        return $this->respond($members->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'employee_code' => $user->employee?->employee_code,
            'roles' => $user->roles->pluck('name')->values(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            // Says up front which rows the buttons will work on, rather than
            // letting someone click and be refused.
            'can_manage' => $this->mayManage($request->user(), $user),
            'is_self' => $user->id === $request->user()->id,
        ]));
    }

    /** Issue the same single-use link the forgot-password flow sends. */
    public function resetLink(Request $request, User $member): JsonResponse
    {
        $this->authorizeTarget($request, $member);

        $token = Password::createToken($member);
        $member->notify(new PasswordResetNotification($token));

        AuditLog::record('auth.password_reset_started', $member, ['by' => $request->user()->email]);

        return $this->respond([
            'email' => $member->email,
            'reset_url' => rtrim(config('app.frontend_url', config('app.url')), '/')
                .'/reset-password?token='.urlencode($token)
                .'&email='.urlencode($member->email),
        ]);
    }

    /**
     * Set someone's password outright.
     *
     * Blunter than a link and the administrator ends up knowing a live
     * credential, so it is the fallback rather than the default — but when
     * there is no mail and the person cannot work a link, it is the thing
     * that actually gets them back in. Their sessions are dropped, so the
     * new password is the only way in from that moment.
     */
    public function setPassword(Request $request, User $member): JsonResponse
    {
        $this->authorizeTarget($request, $member);

        $data = $request->validate([
            'password' => ['required', 'confirmed', PasswordRule::min(10)->letters()->numbers()],
        ]);

        $member->forceFill([
            'password' => Hash::make($data['password']),
            'remember_token' => Str::random(60),
            // Someone who never accepted their invitation can be let in this
            // way too, so the account has to become usable.
            'status' => $member->status === 'disabled' ? 'disabled' : 'active',
        ])->save();

        $member->tokens()->delete();

        AuditLog::record('auth.password_set_by_admin', $member, ['by' => $request->user()->email]);

        return $this->respond(['email' => $member->email, 'status' => $member->fresh()->status]);
    }

    /**
     * Both routes hand over control of an account, so the same rule governs
     * them: you may not reach an account that administers the workspace
     * unless you administer it yourself. Without this, anyone who can manage
     * employees — HR, say — could reset the owner's password and sign in as
     * them, which is a larger privilege than managing employees.
     */
    private function authorizeTarget(Request $request, User $member): void
    {
        $this->requirePermission('hr.employees.manage');

        $actor = $request->user();

        abort_if($member->tenant_id !== $actor->tenant_id, 404);

        abort_if(
            $member->id === $actor->id,
            422,
            'Change your own password from your profile instead.',
        );

        abort_if(
            ! $this->mayManage($actor, $member),
            403,
            'Only a workspace administrator can reset an administrator account.',
        );
    }

    private function mayManage(User $actor, User $member): bool
    {
        if ($member->id === $actor->id) {
            return false;
        }

        if ($actor->hasRole('super_admin') || $actor->hasPermission('settings.roles.manage')) {
            return true;
        }

        // Everyone else is limited to accounts that cannot administer the
        // workspace.
        return ! $member->hasRole('super_admin') && ! $member->hasPermission('settings.roles.manage');
    }
}
