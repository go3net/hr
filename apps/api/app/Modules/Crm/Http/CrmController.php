<?php

namespace App\Modules\Crm\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\CrmActivity;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CrmController extends ApiController
{
    /* ── Leads ─────────────────────────────────────────────────── */

    public function leads(Request $request): JsonResponse
    {
        $this->requirePermission('crm.view');

        $leads = Lead::query()
            ->with('owner:id,name')
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (Lead $l) => [
                'id' => $l->id,
                'name' => $l->name,
                'company' => $l->company,
                'email' => $l->email,
                'phone' => $l->phone,
                'source' => $l->source,
                'status' => $l->status,
                'owner' => $l->owner?->name,
                'created_at' => $l->created_at->toIso8601String(),
            ]);

        return $this->respond($leads);
    }

    public function storeLead(Request $request): JsonResponse
    {
        $this->requirePermission('crm.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'company' => ['nullable', 'string', 'max:160'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'source' => ['nullable', 'in:referral,website,social,cold,event,other'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $lead = Lead::create([...$data, 'owner_id' => $request->user()->id]);
        AuditLog::record('crm.lead_created', $lead);

        return $this->respond(['id' => $lead->id], 201);
    }

    public function updateLead(Request $request, Lead $lead): JsonResponse
    {
        $this->requirePermission('crm.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:160'],
            'company' => ['sometimes', 'nullable', 'string', 'max:160'],
            'email' => ['sometimes', 'nullable', 'email', 'max:190'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'source' => ['sometimes', 'nullable', 'in:referral,website,social,cold,event,other'],
            'status' => ['sometimes', 'in:new,contacted,qualified,lost'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        $lead->update($data);

        return $this->respond(['id' => $lead->id, 'status' => $lead->status]);
    }

    /** Convert a lead into a client, optionally opening a first deal. */
    public function convertLead(Request $request, Lead $lead): JsonResponse
    {
        $this->requirePermission('crm.manage');

        if ($lead->status === 'converted') {
            throw ValidationException::withMessages(['lead' => 'This lead is already converted.']);
        }

        $data = $request->validate([
            'deal_title' => ['nullable', 'string', 'max:160'],
            'deal_value' => ['nullable', 'numeric', 'min:0'],
        ]);

        [$client, $deal] = DB::transaction(function () use ($lead, $data, $request) {
            $client = Client::create([
                'name' => $lead->name,
                'company' => $lead->company,
                'email' => $lead->email,
                'phone' => $lead->phone,
                'owner_id' => $lead->owner_id ?? $request->user()->id,
            ]);

            $lead->update(['status' => 'converted', 'client_id' => $client->id]);

            $deal = null;
            if (! empty($data['deal_title'])) {
                $deal = Deal::create([
                    'client_id' => $client->id,
                    'title' => $data['deal_title'],
                    'value' => $data['deal_value'] ?? 0,
                    'owner_id' => $request->user()->id,
                    'position' => (int) Deal::query()->where('stage', 'qualification')->max('position') + 1,
                ]);
            }

            return [$client, $deal];
        });

        AuditLog::record('crm.lead_converted', $lead);

        return $this->respond([
            'client_id' => $client->id,
            'deal_id' => $deal?->id,
        ], 201);
    }

    /* ── Clients ───────────────────────────────────────────────── */

    public function clients(Request $request): JsonResponse
    {
        $this->requirePermission('crm.view');

        $clients = Client::query()
            ->with('owner:id,name')
            ->withCount('deals')
            ->withSum('deals as pipeline_value', 'value')
            ->when($request->query('q'), fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$term}%")
                ->orWhere('company', 'like', "%{$term}%")))
            ->orderBy('name')
            ->limit(200)
            ->get()
            ->map(fn (Client $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'company' => $c->company,
                'email' => $c->email,
                'phone' => $c->phone,
                'owner' => $c->owner?->name,
                'deals_count' => $c->deals_count,
                'pipeline_value' => (float) ($c->pipeline_value ?? 0),
            ]);

        return $this->respond($clients);
    }

    public function storeClient(Request $request): JsonResponse
    {
        $this->requirePermission('crm.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'company' => ['nullable', 'string', 'max:160'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $client = Client::create([...$data, 'owner_id' => $request->user()->id]);
        AuditLog::record('crm.client_created', $client);

        return $this->respond(['id' => $client->id], 201);
    }

    /* ── Deals ─────────────────────────────────────────────────── */

    public function deals(Request $request): JsonResponse
    {
        $this->requirePermission('crm.view');

        $deals = Deal::query()
            ->with(['client:id,name,company', 'owner:id,name'])
            ->orderBy('position')
            ->limit(500)
            ->get();

        $byStage = $deals->groupBy('stage');
        $stats = collect(Deal::STAGES)->mapWithKeys(fn (string $stage) => [$stage => [
            'count' => $byStage->get($stage)?->count() ?? 0,
            'value' => (float) ($byStage->get($stage)?->sum('value') ?? 0),
        ]]);

        return $this->respond(
            $deals->map(fn (Deal $d) => $this->presentDeal($d)),
            200,
            ['stats' => $stats],
        );
    }

    public function storeDeal(Request $request): JsonResponse
    {
        $this->requirePermission('crm.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'expected_close' => ['nullable', 'date'],
        ]);

        $deal = Deal::create([
            ...$data,
            'owner_id' => $request->user()->id,
            'position' => (int) Deal::query()->where('stage', 'qualification')->max('position') + 1,
        ]);

        AuditLog::record('crm.deal_created', $deal);

        return $this->respond($this->presentDeal($deal->load(['client:id,name,company', 'owner:id,name'])), 201);
    }

    public function updateDeal(Request $request, Deal $deal): JsonResponse
    {
        $this->requirePermission('crm.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:160'],
            'client_id' => ['sometimes', 'nullable', 'integer', 'exists:clients,id'],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'stage' => ['sometimes', 'in:qualification,proposal,negotiation,won,lost'],
            'position' => ['sometimes', 'integer', 'min:0'],
            'expected_close' => ['sometimes', 'nullable', 'date'],
        ]);

        if (isset($data['stage']) && in_array($data['stage'], ['won', 'lost'], true) && ! $deal->closed_at) {
            $data['closed_at'] = now();
        }

        $deal->update($data);
        AuditLog::record('crm.deal_updated', $deal);

        return $this->respond($this->presentDeal($deal->fresh(['client:id,name,company', 'owner:id,name'])));
    }

    /* ── Activities ────────────────────────────────────────────── */

    public function activities(Request $request): JsonResponse
    {
        $this->requirePermission('crm.view');

        $activities = CrmActivity::query()
            ->with('author:id,name')
            ->when($request->query('deal_id'), fn ($q, $id) => $q->where('deal_id', $id))
            ->when($request->query('client_id'), fn ($q, $id) => $q->where('client_id', $id))
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (CrmActivity $a) => [
                'id' => $a->id,
                'kind' => $a->kind,
                'body' => $a->body,
                'author' => $a->author?->name,
                'follow_up_at' => $a->follow_up_at?->toIso8601String(),
                'at' => $a->created_at->toIso8601String(),
            ]);

        return $this->respond($activities);
    }

    public function storeActivity(Request $request): JsonResponse
    {
        $this->requirePermission('crm.manage');

        $data = $request->validate([
            'deal_id' => ['nullable', 'integer', 'exists:deals,id'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'kind' => ['nullable', 'in:note,call,email,meeting'],
            'body' => ['required', 'string', 'max:5000'],
            'follow_up_at' => ['nullable', 'date'],
        ]);

        $activity = CrmActivity::create([
            ...$data,
            'kind' => $data['kind'] ?? 'note',
            'user_id' => $request->user()->id,
        ]);

        return $this->respond(['id' => $activity->id], 201);
    }

    private function presentDeal(Deal $d): array
    {
        return [
            'id' => $d->id,
            'title' => $d->title,
            'value' => (float) $d->value,
            'stage' => $d->stage,
            'position' => $d->position,
            'expected_close' => $d->expected_close?->toDateString(),
            'closed_at' => $d->closed_at?->toIso8601String(),
            'client' => $d->relationLoaded('client') && $d->client
                ? ['id' => $d->client->id, 'name' => $d->client->name, 'company' => $d->client->company]
                : null,
            'owner' => $d->relationLoaded('owner') ? $d->owner?->name : null,
        ];
    }
}
