<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class GrantPlatformOwner extends Command
{
    protected $signature = 'platform:owner {email} {--revoke : Take the access away instead}';

    protected $description = 'Grant or revoke access to the platform console';

    public function handle(): int
    {
        $revoke = (bool) $this->option('revoke');

        // Deliberately unscoped: whoever runs Go3net Office signs in through a
        // workspace like everyone else, and the console sits above all of them.
        $user = User::query()
            ->withoutGlobalScopes()
            ->where('email', $this->argument('email'))
            ->first();

        if (! $user) {
            $this->error("No account with that email.");

            return self::FAILURE;
        }

        $user->forceFill(['is_platform_owner' => ! $revoke])->save();

        $this->info(($revoke ? 'Revoked from ' : 'Granted to ').$user->email.'.');

        if (! $revoke && in_array(mb_strtolower($user->email), config('platform.owners', []), true)) {
            $this->line('This address is also listed in PLATFORM_OWNER_EMAILS, so --revoke alone will not close it.');
        }

        return self::SUCCESS;
    }
}
