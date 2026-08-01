<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Models\UserInvitation;
use App\Modules\Hr\Services\InvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvitationController extends ApiController
{
    public function __construct(private readonly InvitationService $invitations)
    {
    }

    /** Peek at an invite so the setup page can greet the person. */
    public function show(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:80']]);

        $invitation = UserInvitation::withoutGlobalScopes()
            ->with('user:id,name,email,tenant_id')
            ->where('token_hash', hash('sha256', $data['token']))
            ->first();

        if (! $invitation || ! $invitation->isUsable()) {
            return $this->respondError('INVALID_INVITE', 'This invitation link is invalid or has expired.', 410);
        }

        return $this->respond([
            'name' => $invitation->user->name,
            'email' => $invitation->user->email,
        ]);
    }

    /** Set the password, activate the account, and sign the person in. */
    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:80'],
            'password' => ['required', 'string', 'min:10', 'confirmed'],
        ]);

        $user = $this->invitations->accept($data['token'], $data['password']);

        return $this->respond([
            'token' => $user->createToken('api')->plainTextToken,
            'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
        ]);
    }
}
