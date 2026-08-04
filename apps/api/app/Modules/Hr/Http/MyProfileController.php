<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\EmergencyContact;
use App\Models\Employee;
use App\Models\Guarantor;
use App\Modules\Hr\Services\ProfileCompleteness;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Employee self-service. People maintain their own personal, statutory and
 * next-of-kin details; everything that affects pay, role or status stays
 * with HR.
 */
class MyProfileController extends ApiController
{
    public function __construct(private readonly ProfileCompleteness $completeness)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $employee = $this->employeeFor($request);
        if (! $employee) {
            return $this->respondError(
                'NO_EMPLOYEE_RECORD',
                'Your account is not linked to an employee record yet. Ask HR to set one up.',
                404,
            );
        }

        $employee->load(['department:id,name', 'position:id,title', 'manager:id,first_name,last_name', 'emergencyContacts', 'guarantors']);

        return $this->respond([
            // Read-only — HR owns these.
            'employee_code' => $employee->employee_code,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'email' => $employee->email,
            'department' => $employee->department?->name,
            'position' => $employee->position?->title,
            'manager' => $employee->manager
                ? "{$employee->manager->first_name} {$employee->manager->last_name}"
                : null,
            'employment_type' => $employee->employment_type,
            'status' => $employee->status,
            'hired_at' => $employee->hired_at?->toDateString(),

            // Editable by the employee.
            'phone' => $employee->phone,
            'date_of_birth' => $employee->date_of_birth?->toDateString(),
            'gender' => $employee->gender,
            'marital_status' => $employee->marital_status,
            'address' => $employee->address,
            'nin' => $employee->nin,
            'bvn' => $employee->bvn,
            'bank_name' => $employee->bank_name,
            'bank_account_number' => $employee->bank_account_number,
            'pension_pin' => $employee->pension_pin,

            'emergency_contacts' => $employee->emergencyContacts->map(fn (EmergencyContact $c) => [
                'id' => $c->id, 'name' => $c->name, 'relationship' => $c->relationship,
                'phone' => $c->phone, 'address' => $c->address,
            ])->values(),
            'guarantors' => $employee->guarantors->map(fn (Guarantor $g) => [
                'id' => $g->id, 'name' => $g->name, 'occupation' => $g->occupation,
                'phone' => $g->phone, 'address' => $g->address,
            ])->values(),

            'completeness' => $this->completeness->for($employee),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $employee = $this->employeeFor($request);
        if (! $employee) {
            return $this->respondError('NO_EMPLOYEE_RECORD', 'No employee record linked to your account.', 404);
        }

        $data = $request->validate([
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'date_of_birth' => ['sometimes', 'nullable', 'date', 'before:today'],
            'gender' => ['sometimes', 'nullable', 'in:male,female,other'],
            'marital_status' => ['sometimes', 'nullable', 'in:single,married,divorced,widowed'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'nin' => ['sometimes', 'nullable', 'string', 'digits:11'],
            'bvn' => ['sometimes', 'nullable', 'string', 'digits:11'],
            'bank_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'bank_account_number' => ['sometimes', 'nullable', 'string', 'digits:10'],
            'pension_pin' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        $employee->update($data);
        // Values are encrypted at rest — log which fields changed, never what to.
        AuditLog::record('hr.profile_self_updated', $employee, ['fields' => array_keys($data)]);

        return $this->show($request);
    }

    /* ── Emergency contacts ───────────────────────────────────── */

    public function storeContact(Request $request): JsonResponse
    {
        $employee = $this->employeeFor($request);
        if (! $employee) {
            return $this->respondError('NO_EMPLOYEE_RECORD', 'No employee record linked to your account.', 404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'relationship' => ['required', 'string', 'max:40'],
            'phone' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $employee->emergencyContacts()->create($data);

        return $this->show($request);
    }

    public function destroyContact(Request $request, EmergencyContact $contact): JsonResponse
    {
        $employee = $this->employeeFor($request);
        if (! $employee || $contact->employee_id !== $employee->id) {
            return $this->respondError('FORBIDDEN', 'That contact is not yours.', 403);
        }

        $contact->delete();

        return $this->show($request);
    }

    /* ── Guarantors ───────────────────────────────────────────── */

    public function storeGuarantor(Request $request): JsonResponse
    {
        $employee = $this->employeeFor($request);
        if (! $employee) {
            return $this->respondError('NO_EMPLOYEE_RECORD', 'No employee record linked to your account.', 404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'occupation' => ['required', 'string', 'max:80'],
            'phone' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $employee->guarantors()->create($data);

        return $this->show($request);
    }

    public function destroyGuarantor(Request $request, Guarantor $guarantor): JsonResponse
    {
        $employee = $this->employeeFor($request);
        if (! $employee || $guarantor->employee_id !== $employee->id) {
            return $this->respondError('FORBIDDEN', 'That guarantor is not yours.', 403);
        }

        $guarantor->delete();

        return $this->show($request);
    }

    private function employeeFor(Request $request): ?Employee
    {
        return Employee::query()->where('user_id', $request->user()->id)->first();
    }
}
