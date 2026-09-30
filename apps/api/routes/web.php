<?php

use Illuminate\Support\Facades\Route;

/**
 * This service is the API. Anyone who lands on its root typed the wrong
 * host — usually reaching for the app — so send them there rather than
 * showing them Laravel's default page, which reads like a half-finished
 * deployment and invites them to deploy something.
 *
 * Health checks live at /up; the API itself is under /api/v1.
 */
Route::get('/', function () {
    $app = config('app.frontend_url');

    if ($app) {
        return redirect()->away($app);
    }

    return response()->json([
        'service' => config('app.name').' API',
        'docs' => 'https://github.com/go3net/hr/blob/main/docs/05-api.md',
        'health' => url('/up'),
    ]);
});
