<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpUsers(): array
    {
        Storage::fake();
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $uploader = $this->createUserWithRole($tenant, 'employee');
        $other = $this->createUserWithRole($tenant, 'employee');

        return [$tenant, $uploader, $other];
    }

    public function test_upload_list_download_roundtrip(): void
    {
        [, $uploader, $other] = $this->setUpUsers();

        $upload = $this->actingAsTenantUser($uploader)
            ->post('/api/v1/documents', [
                'file' => UploadedFile::fake()->create('handbook.pdf', 120, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data');

        $this->assertSame('handbook.pdf', $upload['name']);
        $this->assertSame('tenant', $upload['visibility']);

        // Tenant-visible → the other user sees and downloads it.
        $list = $this->actingAsTenantUser($other)->getJson('/api/v1/documents')->assertOk()->json('data');
        $this->assertCount(1, $list['documents']);

        $this->actingAsTenantUser($other)
            ->get("/api/v1/documents/{$upload['id']}/download")
            ->assertOk();
    }

    public function test_private_documents_hide_until_shared(): void
    {
        [, $uploader, $other] = $this->setUpUsers();

        $doc = $this->actingAsTenantUser($uploader)
            ->post('/api/v1/documents', [
                'file' => UploadedFile::fake()->create('salary-bands.xlsx', 40),
                'visibility' => 'private',
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data');

        // Invisible and undownloadable for others…
        $list = $this->actingAsTenantUser($other)->getJson('/api/v1/documents')->json('data');
        $this->assertCount(0, $list['documents']);
        $this->actingAsTenantUser($other)
            ->get("/api/v1/documents/{$doc['id']}/download")
            ->assertNotFound();

        // …until explicitly shared.
        $this->actingAsTenantUser($uploader)
            ->postJson("/api/v1/documents/{$doc['id']}/share", ['user_ids' => [$other->id]])
            ->assertOk();

        $this->actingAsTenantUser($other)
            ->get("/api/v1/documents/{$doc['id']}/download")
            ->assertOk();
    }

    public function test_only_uploader_or_manager_can_delete(): void
    {
        [$tenant, $uploader, $other] = $this->setUpUsers();

        $doc = $this->actingAsTenantUser($uploader)
            ->post('/api/v1/documents', [
                'file' => UploadedFile::fake()->create('note.txt', 1),
            ], ['Accept' => 'application/json'])
            ->json('data');

        $this->actingAsTenantUser($other)
            ->deleteJson("/api/v1/documents/{$doc['id']}")
            ->assertForbidden();

        $hr = $this->createUserWithRole($tenant, 'hr_manager'); // has documents.manage
        $this->actingAsTenantUser($hr)
            ->deleteJson("/api/v1/documents/{$doc['id']}")
            ->assertNoContent();
    }

    public function test_folder_navigation_and_empty_delete_rule(): void
    {
        [, $uploader] = $this->setUpUsers();

        $folder = $this->actingAsTenantUser($uploader)
            ->postJson('/api/v1/folders', ['name' => 'Policies'])
            ->assertCreated()
            ->json('data');

        $this->actingAsTenantUser($uploader)->post('/api/v1/documents', [
            'file' => UploadedFile::fake()->create('leave-policy.pdf', 10, 'application/pdf'),
            'folder_id' => $folder['id'],
        ], ['Accept' => 'application/json'])->assertCreated();

        // Root shows the folder; inside shows the file with breadcrumbs.
        $root = $this->actingAsTenantUser($uploader)->getJson('/api/v1/documents')->json('data');
        $this->assertSame('Policies', $root['folders'][0]['name']);
        $this->assertCount(0, $root['documents']);

        $inside = $this->actingAsTenantUser($uploader)
            ->getJson("/api/v1/documents?folder_id={$folder['id']}")
            ->json('data');
        $this->assertCount(1, $inside['documents']);
        $this->assertSame('Policies', $inside['breadcrumbs'][0]['name']);

        // Non-empty folders refuse deletion.
        $this->actingAsTenantUser($uploader)
            ->deleteJson("/api/v1/folders/{$folder['id']}")
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'FOLDER_NOT_EMPTY');
    }
}
