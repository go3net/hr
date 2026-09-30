<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * The paperwork held on a person: ID card, certificates, a signed contract.
 *
 * The documents module files things by folder, which answers "what is in
 * Contracts?" but not "what do we hold on this employee?" — the question HR
 * actually asks, and the one an audit asks.
 *
 * Staff may add and read their own, so an ID card can arrive during
 * onboarding without HR chasing it; only HR can see anybody else's, and only
 * HR can delete.
 */
class EmployeeDocumentController extends ApiController
{
    public function index(Request $request, Employee $employee): JsonResponse
    {
        $this->authorizeRead($request, $employee);

        return $this->respond(
            $employee->documents()->with('uploader:id,name')->latest()->get()
                ->map(fn (EmployeeDocument $d) => $this->present($d)),
        );
    }

    public function store(Request $request, Employee $employee): JsonResponse
    {
        $this->authorizeWrite($request, $employee);

        $data = $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25 MB
            'type' => ['required', 'in:'.implode(',', array_keys(EmployeeDocument::TYPES))],
            'name' => ['nullable', 'string', 'max:160'],
            // Passports and work permits lapse; a licence nobody renewed is
            // worth being able to find.
            'expires_on' => ['nullable', 'date'],
        ]);

        $file = $data['file'];
        $path = $file->store("tenants/{$employee->tenant_id}/employees/{$employee->id}");

        $document = EmployeeDocument::create([
            'employee_id' => $employee->id,
            'type' => $data['type'],
            'name' => ($data['name'] ?? '') ?: $file->getClientOriginalName(),
            'path' => $path,
            'mime' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
            'expires_on' => $data['expires_on'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        AuditLog::record('employee.document_uploaded', $document, [
            'employee' => $employee->employee_code,
            'type' => $document->type,
        ]);

        return $this->respond($this->present($document->load('uploader:id,name')), 201);
    }

    public function download(Request $request, Employee $employee, EmployeeDocument $document): Response
    {
        $this->authorizeRead($request, $employee);
        abort_if($document->employee_id !== $employee->id, 404);

        return Storage::download($document->path, $document->name, [
            'Content-Type' => $document->mime ?? 'application/octet-stream',
        ]);
    }

    public function destroy(Request $request, Employee $employee, EmployeeDocument $document): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');
        abort_if($document->employee_id !== $employee->id, 404);

        // The file goes with the record; a deleted certificate that stays on
        // disk is the worst of both.
        Storage::delete($document->path);
        $document->delete();

        AuditLog::record('employee.document_deleted', null, [
            'employee' => $employee->employee_code,
            'name' => $document->name,
            'by' => $request->user()->email,
        ]);

        return $this->respond(['deleted' => true]);
    }

    /** Your own paperwork is yours; anyone else's needs the HR permission. */
    private function authorizeRead(Request $request, Employee $employee): void
    {
        if ($request->user()->employee?->id === $employee->id) {
            return;
        }

        $this->requirePermission('hr.employees.view');
    }

    private function authorizeWrite(Request $request, Employee $employee): void
    {
        if ($request->user()->employee?->id === $employee->id) {
            return;
        }

        $this->requirePermission('hr.employees.manage');
    }

    private function present(EmployeeDocument $d): array
    {
        return [
            'id' => $d->id,
            'type' => $d->type,
            'type_label' => EmployeeDocument::TYPES[$d->type] ?? $d->type,
            'name' => $d->name,
            'mime' => $d->mime,
            'size_bytes' => (int) $d->size_bytes,
            'expires_on' => $d->expires_on?->toDateString(),
            'has_expired' => $d->expires_on ? $d->expires_on->isPast() : false,
            'uploaded_by' => $d->relationLoaded('uploader') ? $d->uploader?->name : null,
            'uploaded_at' => $d->created_at->toIso8601String(),
        ];
    }
}
