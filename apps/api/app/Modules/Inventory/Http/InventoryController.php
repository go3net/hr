<?php

namespace App\Modules\Inventory\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->requirePermission('inventory.view');

        $items = InventoryItem::query()
            ->when($request->query('q'), function ($query, $q) {
                $query->where(fn ($w) => $w
                    ->where('name', 'like', "%{$q}%")
                    ->orWhere('sku', 'like', "%{$q}%"));
            })
            ->when($request->query('filter.category'), fn ($q, $c) => $q->where('category', $c))
            ->orderBy('name')
            ->limit(300)
            ->get();

        $all = InventoryItem::query()->get(['quantity', 'reorder_level', 'unit_cost']);

        return $this->respond(
            $items->map(fn (InventoryItem $item) => $this->present($item)),
            meta: [
                'total_items' => $all->count(),
                'low_stock' => $all->filter(fn ($i) => (float) $i->reorder_level > 0
                    && (float) $i->quantity <= (float) $i->reorder_level)->count(),
                'stock_value' => (float) $all->sum(fn ($i) => (float) $i->quantity * (float) ($i->unit_cost ?? 0)),
            ],
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('inventory.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'sku' => ['required', 'string', 'max:60'],
            'category' => ['nullable', 'in:'.implode(',', InventoryItem::CATEGORIES)],
            'unit' => ['nullable', 'string', 'max:20'],
            'quantity' => ['nullable', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'location' => ['nullable', 'string', 'max:120'],
        ]);

        if (InventoryItem::query()->where('sku', $data['sku'])->exists()) {
            return $this->respondError('VALIDATION', 'An item with this SKU already exists.', 422);
        }

        $item = InventoryItem::create($data);

        if ((float) $item->quantity > 0) {
            $item->movements()->make([
                'kind' => 'in',
                'quantity' => $item->quantity,
                'note' => 'Opening stock',
                'user_id' => $request->user()->id,
            ])->save();
        }

        AuditLog::record('inventory.item_created', $item, ['sku' => $item->sku]);

        return $this->respond($this->present($item), 201);
    }

    public function update(Request $request, InventoryItem $item): JsonResponse
    {
        $this->requirePermission('inventory.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'category' => ['sometimes', 'nullable', 'in:'.implode(',', InventoryItem::CATEGORIES)],
            'unit' => ['sometimes', 'string', 'max:20'],
            'reorder_level' => ['sometimes', 'numeric', 'min:0'],
            'unit_cost' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'location' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $item->update($data);

        return $this->respond($this->present($item));
    }

    /** Record a movement and update the quantity atomically. */
    public function move(Request $request, InventoryItem $item): JsonResponse
    {
        $this->requirePermission('inventory.manage');

        $data = $request->validate([
            'kind' => ['required', 'in:'.implode(',', StockMovement::KINDS)],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        $result = DB::transaction(function () use ($item, $data, $request) {
            $item = InventoryItem::query()->lockForUpdate()->findOrFail($item->id);

            $newQuantity = match ($data['kind']) {
                'in' => (float) $item->quantity + (float) $data['quantity'],
                'out' => (float) $item->quantity - (float) $data['quantity'],
                'adjust' => (float) $data['quantity'], // absolute restatement
            };

            if ($newQuantity < 0) {
                return null;
            }

            $item->movements()->make([
                'kind' => $data['kind'],
                'quantity' => $data['quantity'],
                'note' => $data['note'] ?? null,
                'user_id' => $request->user()->id,
            ])->save();

            $item->update(['quantity' => $newQuantity]);

            return $item;
        });

        if ($result === null) {
            return $this->respondError('VALIDATION', 'Not enough stock for that movement.', 422);
        }

        return $this->respond($this->present($result));
    }

    public function movements(Request $request, InventoryItem $item): JsonResponse
    {
        $this->requirePermission('inventory.view');

        return $this->respond(
            $item->movements()
                ->with('user:id,name')
                ->orderByDesc('created_at')
                ->limit(100)
                ->get()
                ->map(fn (StockMovement $m) => [
                    'id' => $m->id,
                    'kind' => $m->kind,
                    'quantity' => (float) $m->quantity,
                    'note' => $m->note,
                    'by' => $m->user?->name,
                    'at' => $m->created_at->toIso8601String(),
                ]),
        );
    }

    private function present(InventoryItem $item): array
    {
        return [
            'id' => $item->id,
            'name' => $item->name,
            'sku' => $item->sku,
            'category' => $item->category,
            'unit' => $item->unit,
            'quantity' => (float) $item->quantity,
            'reorder_level' => (float) $item->reorder_level,
            'unit_cost' => $item->unit_cost !== null ? (float) $item->unit_cost : null,
            'location' => $item->location,
            'low_stock' => $item->isLowStock(),
            'updated_at' => $item->updated_at->toIso8601String(),
        ];
    }
}
