<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Platform owners
    |--------------------------------------------------------------------------
    |
    | The people who run Go3net Office as a business rather than running one
    | workspace inside it. They get the platform console — every company, its
    | plan, its trial and what it pays — and nothing more: a customer's staff,
    | salaries and documents stay behind that customer's tenant boundary.
    |
    | Listing an address here grants it on the next deploy without a database
    | change, which is what makes it usable on a hosted stack where nobody has
    | a shell. `php artisan platform:owner {email}` sets the same thing on the
    | user record when a shell is available.
    |
    */

    'owners' => array_values(array_filter(array_map(
        fn (string $email) => mb_strtolower(trim($email)),
        explode(',', (string) env('PLATFORM_OWNER_EMAILS', '')),
    ))),

];
