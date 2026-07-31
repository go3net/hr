<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_item_lifecycle_with_movements_and_low_stock(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $finance = $this->createUserWithRole($tenant, 'finance');

        $item = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/inventory/items', [
                'name' => 'HP EliteBook 840',
                'sku' => 'LAP-001',
                'category' => 'equipment',
                'quantity' => 10,
                'reorder_level' => 3,
                'unit_cost' => 850_000,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertEquals(10, $item['quantity']);
        $this->assertFalse($item['low_stock']);

        // Duplicate SKU rejected.
        $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/inventory/items', ['name' => 'Dup', 'sku' => 'LAP-001'])
            ->assertUnprocessable();

        // Issue 8 laptops → 2 left → low stock.
        $after = $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/inventory/items/{$item['id']}/movements", [
                'kind' => 'out', 'quantity' => 8, 'note' => 'Issued to new hires',
            ])
            ->assertOk()
            ->json('data');
        $this->assertEquals(2, $after['quantity']);
        $this->assertTrue($after['low_stock']);

        // Cannot issue more than stock.
        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/inventory/items/{$item['id']}/movements", ['kind' => 'out', 'quantity' => 5])
            ->assertUnprocessable();

        // Adjust restates the absolute quantity.
        $adjusted = $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/inventory/items/{$item['id']}/movements", [
                'kind' => 'adjust', 'quantity' => 12, 'note' => 'Stock count correction',
            ])
            ->json('data');
        $this->assertEquals(12, $adjusted['quantity']);

        // Movement history: opening + out + adjust.
        $movements = $this->actingAsTenantUser($finance)
            ->getJson("/api/v1/inventory/items/{$item['id']}/movements")
            ->json('data');
        $this->assertCount(3, $movements);

        // Summary meta reflects value and low-stock count.
        $meta = $this->actingAsTenantUser($finance)->getJson('/api/v1/inventory/items')->json('meta');
        $this->assertSame(1, $meta['total_items']);
        $this->assertSame(0, $meta['low_stock']);
        $this->assertEquals(12 * 850_000, $meta['stock_value']);
    }

    public function test_inventory_requires_permission(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)->getJson('/api/v1/inventory/items')->assertForbidden();
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/inventory/items', ['name' => 'x', 'sku' => 'X-1'])
            ->assertForbidden();
    }
}
