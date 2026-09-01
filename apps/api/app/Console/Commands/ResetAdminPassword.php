<?php

namespace App\Console\Commands;

use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class ResetAdminPassword extends Command
{
    protected $signature = 'admin:reset-password {email : Existing workspace-admin or platform-owner email}';

    protected $description = 'Interactively reset an administrator password without exposing it in command history or logs';

    public function handle(): int
    {
        $email = Str::lower((string) $this->argument('email'));
        $user = User::query()->withoutGlobalScopes()->where('email', $email)->first();

        if (! $user) {
            $this->error('No account with that email address.');

            return self::FAILURE;
        }

        if (! $user->is_platform_owner && ! $user->hasRole('super_admin')) {
            $this->error('This command is restricted to workspace administrators and platform owners.');

            return self::FAILURE;
        }

        $password = (string) $this->secret('New password');
        $confirmation = (string) $this->secret('Confirm password');

        $validator = Validator::make([
            'password' => $password,
            'password_confirmation' => $confirmation,
        ], [
            'password' => ['required', 'confirmed', Password::min(10)->letters()->numbers()],
        ]);

        if ($validator->fails()) {
            $this->error($validator->errors()->first('password'));

            return self::FAILURE;
        }

        $user->forceFill([
            'password' => Hash::make($password),
            'remember_token' => Str::random(60),
        ])->save();
        $user->tokens()->delete();

        app(TenantContext::class)->set($user->tenant);
        AuditLog::record('auth.admin_password_reset', $user);

        $this->info("Password reset for {$user->email}. Existing API sessions were revoked.");

        return self::SUCCESS;
    }
}
