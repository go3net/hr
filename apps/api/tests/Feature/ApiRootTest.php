<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiRootTest extends TestCase
{
    public function test_the_api_root_sends_visitors_to_the_app(): void
    {
        // This service is the API. Someone who loads its root reached for the
        // app and got the host wrong — Laravel's default page looks like a
        // half-finished deployment and invites them to deploy something.
        config(['app.frontend_url' => 'https://office.example.test']);

        $this->get('/')->assertRedirect('https://office.example.test');
    }

    public function test_the_api_root_identifies_itself_when_no_app_url_is_set(): void
    {
        config(['app.frontend_url' => null]);

        $this->get('/')
            ->assertOk()
            ->assertJsonStructure(['service', 'docs', 'health']);
    }

    public function test_the_health_check_stays_reachable(): void
    {
        // Railway watches this; a redirect here would fail the deploy.
        $this->get('/up')->assertOk();
    }
}
