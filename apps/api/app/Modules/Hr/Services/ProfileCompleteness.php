<?php

namespace App\Modules\Hr\Services;

use App\Models\Employee;

/**
 * Scores how much of an employee's personnel file is filled in. Drives the
 * self-service prompt for staff and the "profile complete" column for HR.
 */
class ProfileCompleteness
{
    /** Field => human label, grouped by the section it lives in. */
    public const SECTIONS = [
        'personal' => [
            'label' => 'Personal details',
            'fields' => [
                'phone' => 'Phone number',
                'date_of_birth' => 'Date of birth',
                'gender' => 'Gender',
                'marital_status' => 'Marital status',
                'address' => 'Home address',
            ],
        ],
        'statutory' => [
            'label' => 'Statutory & payment',
            'fields' => [
                'nin' => 'NIN',
                'bvn' => 'BVN',
                'bank_name' => 'Bank name',
                'bank_account_number' => 'Account number',
            ],
        ],
    ];

    /**
     * @return array{percent: int, missing: array<int, array{key: string, label: string, section: string}>,
     *               has_emergency_contact: bool, has_guarantor: bool}
     */
    public function for(Employee $employee): array
    {
        $missing = [];
        $total = 0;
        $filled = 0;

        foreach (self::SECTIONS as $key => $section) {
            foreach ($section['fields'] as $field => $label) {
                $total++;
                if (filled($employee->{$field})) {
                    $filled++;
                } else {
                    $missing[] = ['key' => $field, 'label' => $label, 'section' => $key];
                }
            }
        }

        // An emergency contact and a guarantor each count as one more item.
        $hasContact = $employee->emergencyContacts()->exists();
        $hasGuarantor = $employee->guarantors()->exists();
        $total += 2;
        $filled += ($hasContact ? 1 : 0) + ($hasGuarantor ? 1 : 0);

        if (! $hasContact) {
            $missing[] = ['key' => 'emergency_contact', 'label' => 'Emergency contact', 'section' => 'contacts'];
        }
        if (! $hasGuarantor) {
            $missing[] = ['key' => 'guarantor', 'label' => 'Guarantor', 'section' => 'contacts'];
        }

        return [
            'percent' => $total > 0 ? (int) round($filled / $total * 100) : 100,
            'missing' => $missing,
            'has_emergency_contact' => $hasContact,
            'has_guarantor' => $hasGuarantor,
        ];
    }
}
