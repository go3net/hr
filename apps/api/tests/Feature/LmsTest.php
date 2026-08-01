<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class LmsTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_course_authoring_enrollment_and_completion(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        $course = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/lms/courses', [
                'title' => 'Security Awareness',
                'category' => 'compliance',
                'description' => 'Phishing, passwords and device hygiene.',
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('draft', $course['status']);

        // Publishing an empty course is rejected.
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/lms/courses/{$course['id']}", ['status' => 'published'])
            ->assertUnprocessable();

        foreach ([['Spotting phishing', 10], ['Strong passwords', 5]] as [$title, $minutes]) {
            $this->actingAsTenantUser($hr)
                ->postJson("/api/v1/lms/courses/{$course['id']}/lessons", [
                    'title' => $title, 'content' => "## {$title}\nContent here.", 'duration_minutes' => $minutes,
                ])
                ->assertCreated();
        }

        // Drafts are hidden from staff.
        $this->assertCount(0, $this->actingAsTenantUser($employee)->getJson('/api/v1/lms/courses')->json('data'));
        $this->actingAsTenantUser($employee)->getJson("/api/v1/lms/courses/{$course['id']}")->assertNotFound();
        $this->actingAsTenantUser($employee)
            ->postJson("/api/v1/lms/courses/{$course['id']}/enroll")
            ->assertUnprocessable();

        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/lms/courses/{$course['id']}", ['status' => 'published'])
            ->assertOk()
            ->assertJsonPath('data.status', 'published');

        // Employee enrolls and works through the lessons.
        $enrolled = $this->actingAsTenantUser($employee)
            ->postJson("/api/v1/lms/courses/{$course['id']}/enroll")
            ->assertCreated()
            ->json('data');
        $this->assertTrue($enrolled['enrolled']);
        $this->assertSame(0, $enrolled['progress']);

        $detail = $this->actingAsTenantUser($employee)
            ->getJson("/api/v1/lms/courses/{$course['id']}")
            ->json('data');
        $this->assertCount(2, $detail['lessons']);
        [$lesson1, $lesson2] = $detail['lessons'];

        $first = $this->actingAsTenantUser($employee)
            ->postJson("/api/v1/lms/lessons/{$lesson1['id']}/complete")
            ->assertOk()
            ->json('data');
        $this->assertSame(50, $first['progress']);
        $this->assertFalse($first['course_completed']);

        // Completing a lesson twice is idempotent.
        $this->actingAsTenantUser($employee)->postJson("/api/v1/lms/lessons/{$lesson1['id']}/complete");

        $done = $this->actingAsTenantUser($employee)
            ->postJson("/api/v1/lms/lessons/{$lesson2['id']}/complete")
            ->json('data');
        $this->assertSame(100, $done['progress']);
        $this->assertTrue($done['course_completed']);

        // Completion requires enrollment.
        $other = $this->createUserWithRole($tenant, 'employee');
        $this->actingAsTenantUser($other)
            ->postJson("/api/v1/lms/lessons/{$lesson1['id']}/complete")
            ->assertUnprocessable();
    }

    public function test_authoring_requires_permission(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/lms/courses', ['title' => 'Nope'])
            ->assertForbidden();
    }
}
