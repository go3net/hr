<?php

/**
 * Payroll rules, versioned by tax year so historical runs stay correct
 * when legislation changes. Amounts are annual NGN unless noted.
 */
return [

    'pension' => [
        // Pension Reform Act: employee 8%, employer 10% of pensionable pay
        // (basic + housing + transport allowances where itemized).
        'employee_rate' => 0.08,
        'employer_rate' => 0.10,
        'pensionable_allowances' => ['housing', 'transport'],
    ],

    /*
     * Progressive PAYE bands per tax year. Each band is [ceiling, rate]
     * where ceiling is the cumulative upper bound of annual taxable income
     * covered by that band. The engine picks the latest year <= run year.
     */
    'paye_tables' => [

        // Nigeria Tax Act 2025, effective 1 January 2026.
        2026 => [
            'bands' => [
                [800_000, 0.00],
                [3_000_000, 0.15],      // next 2,200,000
                [12_000_000, 0.18],     // next 9,000,000
                [25_000_000, 0.21],     // next 13,000,000
                [50_000_000, 0.23],     // next 25,000,000
                [PHP_INT_MAX, 0.25],    // above 50,000,000
            ],
        ],

        // Personal Income Tax Act (pre-2026) with CRA — kept for historical runs.
        2011 => [
            'bands' => [
                [300_000, 0.07],
                [600_000, 0.11],
                [1_100_000, 0.15],
                [1_600_000, 0.19],
                [3_200_000, 0.21],
                [PHP_INT_MAX, 0.24],
            ],
            'consolidated_relief' => true, // CRA: max(200k, 1% gross) + 20% gross
        ],
    ],
];
