<?php

use App\Core\Modules\EnsureModuleEnabled;
use App\Core\Tenancy\ResolveTenant;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'module' => EnsureModuleEnabled::class,
        ]);

        // Tenant context MUST be bound before route-model binding runs,
        // otherwise bound models resolve without the tenant scope and a
        // cross-tenant id could leak. Route-level middleware executes
        // after SubstituteBindings, so ResolveTenant is ordered ahead of
        // it explicitly.
        $middleware->priority([
            \Illuminate\Auth\Middleware\Authenticate::class,
            ResolveTenant::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
