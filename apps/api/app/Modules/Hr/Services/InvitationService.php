<?php

namespace App\Modules\Hr\Services;

use App\Core\Notifications\UserInvited;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Role;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InvitationService
{
    /**
     * Create (or reuse) the employee's user account and email a fresh
     * single-use setup link. Returns the invited user and the setup URL so
     * admins can also share the link directly (e.g. before SMTP is set up).
     *
     * @return array{user: User, setup_url: string}
     */
    public function invite(Employee $employee, User $invitedBy): array
    {
        if (! $employee->email) {
            throw ValidationException::withMessages(['email' => 'Add an email address to this employee first.']);
        }

        $user = $employee->user;
        if ($user && $user->status === 'active') {
            throw ValidationException::withMessages(['email' => 'This employee already has an active account.']);
        }

        // The email must not belong to someone else in the workspace.
        $existing = User::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('email', $employee->email)
            ->first();
        if ($existing && $employee->user_id !== $existing->id) {
            throw ValidationException::withMessages(['email' => 'Another member already uses this email address.']);
        }

        $token = Str::random(64);

        DB::transaction(function () use ($employee, &$user, $existing, $token) {
            $user ??= $existing ?? User::create([
                'tenant_id' => $employee->tenant_id,
                'name' => "{$employee->first_name} {$employee->last_name}",
                'email' => $employee->email,
                'password' => Str::random(40), // unusable until the invite is accepted
                'status' => 'invited',
            ]);

            if ($user->status !== 'active') {
                $user->update(['status' => 'invited']);
            }
            if ($employee->user_id !== $user->id) {
                $employee->update(['user_id' => $user->id]);
            }

            $role = Role::query()->whereNull('tenant_id')->where('key', 'employee')->first();
            if ($role && ! $user->roles()->whereKey($role->id)->exists()) {
                $user->roles()->attach($role->id);
            }

            // One live invitation at a time.
            UserInvitation::withoutGlobalScopes()->where('user_id', $user->id)->whereNull('accepted_at')->delete();
            UserInvitation::create([
                'tenant_id' => $employee->tenant_id,
                'user_id' => $user->id,
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addDays(7),
            ]);
        });

        $user->notify(new UserInvited(
            $employee->tenant->name,
            $invitedBy->name,
            $token,
        ));

        AuditLog::record('employee.invited', $employee, ['email' => $employee->email]);

        return [
            'user' => $user,
            'setup_url' => rtrim(config('app.frontend_url', config('app.url')), '/')
                .'/accept-invite?token='.$token,
        ];
    }

    /** Accept an invite: set the password, activate, return the user. */
    public function accept(string $token, string $password): User
    {
        $invitation = UserInvitation::withoutGlobalScopes()
            ->where('token_hash', hash('sha256', $token))
            ->first();

        if (! $invitation || ! $invitation->isUsable()) {
            throw ValidationException::withMessages([
                'token' => 'This invitation link is invalid or has expired. Ask your administrator to send a new one.',
            ]);
        }

        $user = $invitation->user;

        DB::transaction(function () use ($invitation, $user, $password) {
            $user->update(['password' => $password, 'status' => 'active']);
            $invitation->update(['accepted_at' => now()]);
        });

        return $user->fresh();
    }
}
