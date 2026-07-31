<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\JobApplicant;
use App\Models\JobOpening;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecruitmentController extends ApiController
{
    /* ── Openings ─────────────────────────────────────────────── */

    public function openings(Request $request): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');

        $openings = JobOpening::query()
            ->with('department:id,name')
            ->withCount('applicants')
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (JobOpening $o) => $this->presentOpening($o));

        return $this->respond($openings);
    }

    public function storeOpening(Request $request): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'employment_type' => ['nullable', 'in:full_time,part_time,contract,internship,nysc'],
            'description' => ['nullable', 'string', 'max:8000'],
            'openings_count' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $opening = JobOpening::create([...$data, 'created_by' => $request->user()->id]);
        AuditLog::record('hr.opening_created', $opening, ['title' => $opening->title]);

        return $this->respond($this->presentOpening($opening->load('department:id,name')), 201);
    }

    public function updateOpening(Request $request, JobOpening $opening): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:160'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'employment_type' => ['sometimes', 'in:full_time,part_time,contract,internship,nysc'],
            'description' => ['sometimes', 'nullable', 'string', 'max:8000'],
            'openings_count' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => ['sometimes', 'in:'.implode(',', JobOpening::STATUSES)],
        ]);

        $opening->update($data);

        return $this->respond($this->presentOpening($opening->fresh(['department:id,name'])->loadCount('applicants')));
    }

    /* ── Applicants ───────────────────────────────────────────── */

    public function applicants(Request $request, JobOpening $opening): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');

        $applicants = $opening->applicants()
            ->orderBy('created_at')
            ->get()
            ->map(fn (JobApplicant $a) => $this->presentApplicant($a));

        return $this->respond($applicants);
    }

    public function storeApplicant(Request $request, JobOpening $opening): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'source' => ['nullable', 'in:'.implode(',', JobApplicant::SOURCES)],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        if ($opening->status === 'closed') {
            return $this->respondError('VALIDATION', 'This opening is closed to new applicants.', 422);
        }

        $applicant = $opening->applicants()->make($data);
        $applicant->save();

        return $this->respond($this->presentApplicant($applicant), 201);
    }

    public function updateApplicant(Request $request, JobApplicant $applicant): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');

        $data = $request->validate([
            'stage' => ['sometimes', 'in:'.implode(',', JobApplicant::STAGES)],
            'rating' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:5'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:4000'],
        ]);

        // Hiring goes through the dedicated endpoint so an employee record
        // is always created alongside.
        if (($data['stage'] ?? null) === 'hired' && $applicant->stage !== 'hired') {
            return $this->respondError('VALIDATION', 'Use the hire action to mark an applicant hired.', 422);
        }

        $applicant->update($data);

        return $this->respond($this->presentApplicant($applicant));
    }

    /** Convert an applicant into an employee record. */
    public function hire(Request $request, JobApplicant $applicant): JsonResponse
    {
        $this->requirePermission('hr.recruitment.manage');
        $this->requirePermission('hr.employees.manage');

        if ($applicant->stage === 'hired') {
            return $this->respondError('VALIDATION', 'This applicant is already hired.', 422);
        }

        $data = $request->validate([
            'employee_code' => ['required', 'string', 'max:40'],
            'hired_at' => ['nullable', 'date'],
        ]);

        $opening = $applicant->opening;
        [$first, $last] = str($applicant->name)->contains(' ')
            ? explode(' ', $applicant->name, 2)
            : [$applicant->name, '-'];

        $employee = DB::transaction(function () use ($applicant, $opening, $data, $first, $last) {
            $employee = Employee::create([
                'employee_code' => $data['employee_code'],
                'first_name' => $first,
                'last_name' => $last,
                'email' => $applicant->email,
                'phone' => $applicant->phone,
                'department_id' => $opening->department_id,
                'employment_type' => $opening->employment_type,
                'hired_at' => $data['hired_at'] ?? now()->toDateString(),
                'status' => 'active',
            ]);

            $applicant->update(['stage' => 'hired', 'hired_employee_id' => $employee->id]);

            return $employee;
        });

        AuditLog::record('hr.applicant_hired', $applicant, [
            'employee_code' => $employee->employee_code,
            'opening' => $opening->title,
        ]);

        return $this->respond([
            ...$this->presentApplicant($applicant->fresh()),
            'employee_public_id' => $employee->public_id,
        ]);
    }

    private function presentOpening(JobOpening $opening): array
    {
        return [
            'id' => $opening->id,
            'title' => $opening->title,
            'department' => $opening->department?->name,
            'department_id' => $opening->department_id,
            'employment_type' => $opening->employment_type,
            'description' => $opening->description,
            'status' => $opening->status,
            'openings_count' => $opening->openings_count,
            'applicants_count' => $opening->applicants_count ?? null,
            'created_at' => $opening->created_at->toIso8601String(),
        ];
    }

    private function presentApplicant(JobApplicant $applicant): array
    {
        return [
            'id' => $applicant->id,
            'opening_id' => $applicant->job_opening_id,
            'name' => $applicant->name,
            'email' => $applicant->email,
            'phone' => $applicant->phone,
            'source' => $applicant->source,
            'stage' => $applicant->stage,
            'rating' => $applicant->rating,
            'notes' => $applicant->notes,
            'hired' => $applicant->hired_employee_id !== null,
            'created_at' => $applicant->created_at->toIso8601String(),
        ];
    }
}
