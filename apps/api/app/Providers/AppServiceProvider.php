<?php

namespace App\Providers;

use App\Core\Tenancy\TenantContext;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TenantContext::class);
    }

    public function boot(): void
    {
        // Permission gate: controllers call Gate::authorize('permission', ['hr.employees.view']).
        Gate::define('permission', fn (User $user, string $permission) => $user->hasPermission($permission));

        // Socialite: Microsoft is a community provider registered by event.
        Event::listen(
            \SocialiteProviders\Manager\SocialiteWasCalled::class,
            [\SocialiteProviders\Microsoft\MicrosoftExtendSocialite::class, 'handle'],
        );
    }
}
