<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class ProjectTaskTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpUsers(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $pm = $this->createUserWithRole($tenant, 'project_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        return [$tenant, $pm, $employee];
    }

    public function test_pm_can_create_a_project_and_employee_can_view_it(): void
    {
        [, $pm, $employee] = $this->setUpUsers();

        $project = $this->actingAsTenantUser($pm)
            ->postJson('/api/v1/projects', [
                'name' => 'Website revamp',
                'member_ids' => [$employee->id],
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Website revamp')
            ->json('data');

        // Creator + listed member are on the project.
        $this->assertCount(2, $project['members']);

        $this->actingAsTenantUser($employee)
            ->getJson('/api/v1/projects')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Website revamp');

        // Employees cannot create projects.
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/projects', ['name' => 'Nope'])
            ->assertForbidden();
    }

    public function test_task_lifecycle_with_kanban_move(): void
    {
        [, $pm] = $this->setUpUsers();

        $project = $this->actingAsTenantUser($pm)
            ->postJson('/api/v1/projects', ['name' => 'Launch'])
            ->json('data');

        $task = $this->actingAsTenantUser($pm)
            ->postJson('/api/v1/tasks', [
                'title' => 'Design landing page',
                'project_id' => $project['id'],
                'priority' => 'high',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'todo')
            ->json('data');

        // Kanban move: column + position update.
        $this->actingAsTenantUser($pm)
            ->patchJson("/api/v1/tasks/{$task['id']}", ['status' => 'in_progress', 'position' => 3])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.position', 3);

        // Completing stamps completed_at.
        $done = $this->actingAsTenantUser($pm)
            ->patchJson("/api/v1/tasks/{$task['id']}", ['status' => 'done'])
            ->assertOk()
            ->json('data');
        $this->assertNotNull($done['completed_at']);

        // Project rollup counts the done task.
        $this->actingAsTenantUser($pm)
            ->getJson("/api/v1/projects/{$project['id']}")
            ->assertOk()
            ->assertJsonPath('data.tasks_count', 1)
            ->assertJsonPath('data.done_tasks_count', 1);
    }

    /**
     * The create form now sends a description and an explicit assignee list.
     * Previously it sent neither, so every task silently fell to its creator
     * and could never carry any detail.
     */
    public function test_task_carries_a_description_and_can_be_delegated(): void
    {
        [, $pm, $employee] = $this->setUpUsers();

        $task = $this->actingAsTenantUser($pm)
            ->postJson('/api/v1/tasks', [
                'title' => 'Draft the Q3 board pack',
                'description' => "Pull headcount and payroll figures.\nCirculate by Friday.",
                'priority' => 'high',
                'status' => 'in_progress',
                'due_date' => now()->addWeek()->toDateString(),
                'assignee_ids' => [$employee->id],
            ])
            ->assertCreated()
            ->assertJsonPath('data.description', "Pull headcount and payroll figures.\nCirculate by Friday.")
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.priority', 'high')
            ->json('data');

        // Delegated away from the creator, not silently kept.
        $this->assertSame([$employee->id], collect($task['assignees'])->pluck('id')->all());

        // It reaches the assignee's "my tasks". The creator keeps sight of it
        // too — mine=1 means "work I am involved in", assigned or delegated.
        $this->actingAsTenantUser($employee)
            ->getJson('/api/v1/tasks?mine=1')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Draft the Q3 board pack');

        $this->actingAsTenantUser($pm)
            ->getJson('/api/v1/tasks?mine=1')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    /** The detail dialog can now edit every field, not just status/priority. */
    public function test_task_edit_updates_details_and_reassigns(): void
    {
        [$tenant, $pm, $employee] = $this->setUpUsers();
        $other = $this->createUserWithRole($tenant, 'employee', ['email' => 'other@example.test']);

        $task = $this->actingAsTenantUser($pm)
            ->postJson('/api/v1/tasks', [
                'title' => 'Old title',
                'assignee_ids' => [$employee->id],
            ])
            ->assertCreated()
            ->json('data');

        $updated = $this->actingAsTenantUser($pm)
            ->patchJson("/api/v1/tasks/{$task['id']}", [
                'title' => 'New title',
                'description' => 'Now with context.',
                'due_date' => now()->addDays(3)->toDateString(),
                'assignee_ids' => [$other->id],
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'New title')
            ->assertJsonPath('data.description', 'Now with context.')
            ->json('data');

        $this->assertSame([$other->id], collect($updated['assignees'])->pluck('id')->all());
    }

    /** Clearing the description sends null rather than dropping the field. */
    public function test_description_can_be_cleared(): void
    {
        [, $pm] = $this->setUpUsers();

        $task = $this->actingAsTenantUser($pm)
            ->postJson('/api/v1/tasks', ['title' => 'Task', 'description' => 'Something'])
            ->assertCreated()
            ->json('data');

        $this->actingAsTenantUser($pm)
            ->patchJson("/api/v1/tasks/{$task['id']}", ['description' => null])
            ->assertOk()
            ->assertJsonPath('data.description', null);
    }

    public function test_only_involved_users_or_managers_can_edit_a_task(): void
    {
        [, $pm, $employee] = $this->setUpUsers();

        // Employee's personal task (self-assigned by default).
        $task = $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/tasks', ['title' => 'My personal task'])
            ->assertCreated()
            ->json('data');

        // A second uninvolved employee cannot edit it.
        $tenant = $employee->tenant;
        $stranger = $this->createUserWithRole($tenant, 'employee');
        $this->actingAsTenantUser($stranger)
            ->patchJson("/api/v1/tasks/{$task['id']}", ['status' => 'done'])
            ->assertForbidden();

        // The owner can; a projects manager can too.
        $this->actingAsTenantUser($employee)
            ->patchJson("/api/v1/tasks/{$task['id']}", ['status' => 'in_progress'])
            ->assertOk();
        $this->actingAsTenantUser($pm)
            ->patchJson("/api/v1/tasks/{$task['id']}", ['priority' => 'low'])
            ->assertOk();
    }

    public function test_my_tasks_filter_and_comments(): void
    {
        [, $pm, $employee] = $this->setUpUsers();

        $this->actingAsTenantUser($pm)->postJson('/api/v1/tasks', [
            'title' => 'PM only task',
        ]);
        $task = $this->actingAsTenantUser($pm)->postJson('/api/v1/tasks', [
            'title' => 'Shared task',
            'assignee_ids' => [$employee->id],
        ])->json('data');

        $mine = $this->actingAsTenantUser($employee)
            ->getJson('/api/v1/tasks?mine=1')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $mine);
        $this->assertSame('Shared task', $mine[0]['title']);

        $this->actingAsTenantUser($employee)
            ->postJson("/api/v1/tasks/{$task['id']}/comments", ['body' => 'On it — ETA Friday.'])
            ->assertCreated();

        $comments = $this->actingAsTenantUser($pm)
            ->getJson("/api/v1/tasks/{$task['id']}/comments")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $comments);
        $this->assertSame('On it — ETA Friday.', $comments[0]['body']);
    }
}
