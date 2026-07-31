<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Paystack
    |--------------------------------------------------------------------------
    | Card / bank / USSD / transfer payments for Nigerian customers. Billing
    | is disabled (checkout returns BILLING_NOT_CONFIGURED) until a secret
    | key is set.
    */

    'paystack' => [
        'secret_key' => env('PAYSTACK_SECRET_KEY'),
        'public_key' => env('PAYSTACK_PUBLIC_KEY'),
        'base_url' => env('PAYSTACK_BASE_URL', 'https://api.paystack.co'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Plans
    |--------------------------------------------------------------------------
    | Monthly prices in Naira. A successful charge extends the subscription
    | by one month from the later of "now" and the current period end, so
    | renewing early never loses time.
    */

    'trial_days' => 14,

    'plans' => [
        'starter' => [
            'name' => 'Starter',
            'price' => 25_000,
            'max_employees' => 15,
            'blurb' => 'For small teams getting organised.',
            'features' => ['Up to 15 staff', 'All core modules', 'Email support'],
        ],
        'growth' => [
            'name' => 'Growth',
            'price' => 60_000,
            'max_employees' => 50,
            'blurb' => 'For growing companies that need the full toolkit.',
            'features' => ['Up to 50 staff', 'All modules incl. payroll & AI', 'Priority support'],
        ],
        'scale' => [
            'name' => 'Scale',
            'price' => 150_000,
            'max_employees' => null,
            'blurb' => 'For established organisations at any size.',
            'features' => ['Unlimited staff', 'All modules incl. payroll & AI', 'Dedicated support', 'White-label ready'],
        ],
    ],
];
