<?php

namespace App\Modules\Finance\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\FinanceCategory;
use App\Models\Invoice;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceController extends ApiController
{
    /** Month summary: income, approved expenses, net, invoice outstanding. */
    public function summary(Request $request): JsonResponse
    {
        $this->requirePermission('finance.view');

        $month = $request->query('month', now()->format('Y-m'));
        [$year, $monthNum] = explode('-', $month);

        $base = Transaction::query()
            ->where('status', 'approved')
            ->whereYear('occurred_on', $year)
            ->whereMonth('occurred_on', $monthNum);

        $income = (float) (clone $base)->where('kind', 'income')->sum('amount');
        $expenses = (float) (clone $base)->where('kind', 'expense')->sum('amount');

        $outstanding = (float) Invoice::query()
            ->whereIn('status', ['sent', 'partial', 'overdue'])
            ->get()
            ->sum(fn (Invoice $i) => (float) $i->total - $i->paidAmount());

        return $this->respond([
            'month' => $month,
            'income' => $income,
            'expenses' => $expenses,
            'net' => $income - $expenses,
            'outstanding_invoices' => $outstanding,
            'pending_expenses' => Transaction::query()->where('status', 'pending')->count(),
        ]);
    }

    /* ── Categories & transactions ─────────────────────────────── */

    public function categories(): JsonResponse
    {
        $this->requirePermission('finance.view');

        return $this->respond(FinanceCategory::query()->orderBy('name')->get(['id', 'name', 'kind']));
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->requirePermission('finance.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'kind' => ['required', 'in:income,expense'],
        ]);

        return $this->respond(FinanceCategory::create($data)->only(['id', 'name', 'kind']), 201);
    }

    public function transactions(Request $request): JsonResponse
    {
        $this->requirePermission('finance.view');

        $transactions = Transaction::query()
            ->with(['category:id,name', 'creator:id,name'])
            ->when($request->query('filter.kind'), fn ($q, $k) => $q->where('kind', $k))
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (Transaction $t) => $this->presentTransaction($t));

        return $this->respond($transactions);
    }

    public function storeTransaction(Request $request): JsonResponse
    {
        $this->requirePermission('finance.manage');

        $data = $request->validate([
            'kind' => ['required', 'in:income,expense'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['required', 'string', 'max:255'],
            'occurred_on' => ['required', 'date'],
            'finance_category_id' => ['nullable', 'integer', 'exists:finance_categories,id'],
        ]);

        $transaction = Transaction::create([
            ...$data,
            // Expenses wait for approval; income posts immediately.
            'status' => $data['kind'] === 'expense' ? 'pending' : 'approved',
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('finance.transaction_created', $transaction);

        return $this->respond($this->presentTransaction($transaction->load(['category:id,name', 'creator:id,name'])), 201);
    }

    public function decideTransaction(Request $request, Transaction $transaction, string $decision): JsonResponse
    {
        $this->requirePermission('finance.manage');

        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);

        if ($transaction->status !== 'pending') {
            throw ValidationException::withMessages(['status' => 'Only pending expenses can be decided.']);
        }

        $transaction->update([
            'status' => $decision === 'approve' ? 'approved' : 'rejected',
            'decided_by' => $request->user()->id,
        ]);

        AuditLog::record("finance.expense_{$decision}d", $transaction);

        return $this->respond($this->presentTransaction($transaction->fresh(['category:id,name', 'creator:id,name'])));
    }

    /* ── Invoices ──────────────────────────────────────────────── */

    public function invoices(): JsonResponse
    {
        $this->requirePermission('finance.view');

        $invoices = Invoice::query()
            ->with('client:id,name')
            ->withSum('payments as paid_amount', 'amount')
            ->orderByDesc('issue_date')
            ->limit(200)
            ->get()
            ->map(fn (Invoice $i) => $this->presentInvoice($i));

        return $this->respond($invoices);
    }

    public function storeInvoice(Request $request): JsonResponse
    {
        $this->requirePermission('finance.manage');

        $data = $request->validate([
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'issue_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        $invoice = DB::transaction(function () use ($data, $request) {
            $year = date('Y', strtotime($data['issue_date']));
            $sequence = Invoice::query()->withTrashed()->where('number', 'like', "INV-{$year}-%")->count() + 1;

            $subtotal = collect($data['items'])->sum(fn ($i) => $i['quantity'] * $i['unit_price']);
            $taxRate = (float) ($data['tax_rate'] ?? 0);
            $taxAmount = round($subtotal * $taxRate / 100, 2);

            $invoice = Invoice::create([
                'client_id' => $data['client_id'] ?? null,
                'number' => sprintf('INV-%s-%04d', $year, $sequence),
                'issue_date' => $data['issue_date'],
                'due_date' => $data['due_date'] ?? null,
                'subtotal' => $subtotal,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total' => $subtotal + $taxAmount,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] as $item) {
                $invoice->items()->create([
                    ...$item,
                    'line_total' => round($item['quantity'] * $item['unit_price'], 2),
                ]);
            }

            return $invoice;
        });

        AuditLog::record('finance.invoice_created', $invoice);

        return $this->respond($this->presentInvoice($invoice->load('client:id,name')), 201);
    }

    public function showInvoice(Invoice $invoice): JsonResponse
    {
        $this->requirePermission('finance.view');

        $invoice->load(['client:id,name,email', 'items', 'payments'])
            ->loadSum('payments as paid_amount', 'amount');

        return $this->respond($this->presentInvoice($invoice) + [
            'items' => $invoice->items->map(fn ($i) => [
                'description' => $i->description,
                'quantity' => (float) $i->quantity,
                'unit_price' => (float) $i->unit_price,
                'line_total' => (float) $i->line_total,
            ]),
            'payments' => $invoice->payments->map(fn ($p) => [
                'amount' => (float) $p->amount,
                'paid_on' => $p->paid_on->toDateString(),
                'method' => $p->method,
                'reference' => $p->reference,
            ]),
        ]);
    }

    public function sendInvoice(Invoice $invoice): JsonResponse
    {
        $this->requirePermission('finance.manage');

        if ($invoice->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft invoices can be sent.']);
        }

        $invoice->update(['status' => 'sent']);
        AuditLog::record('finance.invoice_sent', $invoice);

        return $this->respond($this->presentInvoice($invoice->fresh('client:id,name')));
    }

    public function recordPayment(Request $request, Invoice $invoice): JsonResponse
    {
        $this->requirePermission('finance.manage');

        if ($invoice->status === 'draft') {
            throw ValidationException::withMessages(['status' => 'Send the invoice before recording payments.']);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'paid_on' => ['required', 'date'],
            'method' => ['nullable', 'in:transfer,cash,card,other'],
            'reference' => ['nullable', 'string', 'max:120'],
        ]);

        $invoice->payments()->create([
            ...$data,
            'method' => $data['method'] ?? 'transfer',
            'recorded_by' => $request->user()->id,
        ]);

        $invoice->refreshPaymentStatus();

        // Paid invoices post income automatically.
        if ($invoice->fresh()->status === 'paid') {
            Transaction::create([
                'kind' => 'income',
                'amount' => $invoice->total,
                'description' => "Invoice {$invoice->number}".($invoice->client ? " · {$invoice->client->name}" : ''),
                'occurred_on' => $data['paid_on'],
                'status' => 'approved',
                'created_by' => $request->user()->id,
            ]);
        }

        AuditLog::record('finance.payment_recorded', $invoice);

        return $this->respond($this->presentInvoice($invoice->fresh('client:id,name')->loadSum('payments as paid_amount', 'amount')));
    }

    private function presentTransaction(Transaction $t): array
    {
        return [
            'id' => $t->id,
            'kind' => $t->kind,
            'amount' => (float) $t->amount,
            'description' => $t->description,
            'category' => $t->relationLoaded('category') ? $t->category?->name : null,
            'occurred_on' => $t->occurred_on->toDateString(),
            'status' => $t->status,
            'created_by' => $t->relationLoaded('creator') ? $t->creator?->name : null,
        ];
    }

    private function presentInvoice(Invoice $i): array
    {
        return [
            'id' => $i->id,
            'number' => $i->number,
            'client' => $i->relationLoaded('client') ? $i->client?->name : null,
            'status' => $i->status,
            'issue_date' => $i->issue_date->toDateString(),
            'due_date' => $i->due_date?->toDateString(),
            'subtotal' => (float) $i->subtotal,
            'tax_rate' => (float) $i->tax_rate,
            'total' => (float) $i->total,
            'paid_amount' => (float) ($i->paid_amount ?? 0),
        ];
    }
}
