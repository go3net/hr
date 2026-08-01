<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpUsers(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $finance = $this->createUserWithRole($tenant, 'finance');
        $employee = $this->createUserWithRole($tenant, 'employee');

        return [$tenant, $finance, $employee];
    }

    public function test_expenses_require_approval_but_income_posts_immediately(): void
    {
        [, $finance] = $this->setUpUsers();

        $income = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/finance/transactions', [
                'kind' => 'income',
                'amount' => 500_000,
                'description' => 'Consulting retainer',
                'occurred_on' => now()->toDateString(),
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('approved', $income['status']);

        $expense = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/finance/transactions', [
                'kind' => 'expense',
                'amount' => 120_000,
                'description' => 'Team offsite',
                'occurred_on' => now()->toDateString(),
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('pending', $expense['status']);

        // Pending expenses don't count in the summary yet.
        $summary = $this->actingAsTenantUser($finance)->getJson('/api/v1/finance/summary')->json('data');
        $this->assertEquals(500_000, $summary['income']);
        $this->assertEquals(0, $summary['expenses']);
        $this->assertSame(1, $summary['pending_expenses']);

        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/finance/transactions/{$expense['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $after = $this->actingAsTenantUser($finance)->getJson('/api/v1/finance/summary')->json('data');
        $this->assertEquals(120_000, $after['expenses']);
        $this->assertEquals(380_000, $after['net']);
    }

    public function test_invoice_lifecycle_partial_then_paid_posts_income(): void
    {
        [, $finance] = $this->setUpUsers();

        $invoice = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/finance/invoices', [
                'issue_date' => now()->toDateString(),
                'due_date' => now()->addDays(14)->toDateString(),
                'tax_rate' => 7.5,
                'items' => [
                    ['description' => 'Platform setup', 'quantity' => 1, 'unit_price' => 1_000_000],
                    ['description' => 'Training day', 'quantity' => 2, 'unit_price' => 250_000],
                ],
            ])
            ->assertCreated()
            ->json('data');

        // 1,500,000 + 7.5% tax = 1,612,500; numbering is INV-YYYY-0001.
        $this->assertEquals(1_612_500, $invoice['total']);
        $this->assertStringStartsWith('INV-'.now()->format('Y').'-0001', $invoice['number']);
        $this->assertSame('draft', $invoice['status']);

        // Payments are blocked on drafts.
        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/finance/invoices/{$invoice['id']}/payments", [
                'amount' => 500_000, 'paid_on' => now()->toDateString(),
            ])
            ->assertUnprocessable();

        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/finance/invoices/{$invoice['id']}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent');

        $partial = $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/finance/invoices/{$invoice['id']}/payments", [
                'amount' => 612_500, 'paid_on' => now()->toDateString(),
            ])
            ->assertOk()
            ->json('data');
        $this->assertSame('partial', $partial['status']);

        $paid = $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/finance/invoices/{$invoice['id']}/payments", [
                'amount' => 1_000_000, 'paid_on' => now()->toDateString(), 'method' => 'transfer',
            ])
            ->assertOk()
            ->json('data');
        $this->assertSame('paid', $paid['status']);

        // Full payment auto-posted the income transaction.
        $summary = $this->actingAsTenantUser($finance)->getJson('/api/v1/finance/summary')->json('data');
        $this->assertEquals(1_612_500, $summary['income']);
        $this->assertEquals(0, $summary['outstanding_invoices']);
    }

    public function test_finance_permission_required(): void
    {
        [, , $employee] = $this->setUpUsers();

        $this->actingAsTenantUser($employee)->getJson('/api/v1/finance/summary')->assertForbidden();
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/finance/transactions', [
                'kind' => 'income', 'amount' => 1, 'description' => 'x', 'occurred_on' => now()->toDateString(),
            ])
            ->assertForbidden();
    }
}
