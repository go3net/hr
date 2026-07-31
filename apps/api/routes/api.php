<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Auth\OAuthController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\ModuleController;
use App\Http\Controllers\NotificationController;
use App\Modules\Dashboard\Http\DashboardController;
use App\Modules\Chat\Http\ChatController;
use App\Modules\Crm\Http\CrmController;
use App\Modules\Documents\Http\DocumentController;
use App\Modules\Finance\Http\FinanceController;
use App\Modules\Documents\Http\FolderController;
use App\Modules\Hr\Http\AttendanceController;
use App\Modules\Hr\Http\DepartmentController;
use App\Modules\Hr\Http\EmployeeController;
use App\Modules\Hr\Http\LeaveController;
use App\Modules\Hr\Http\PayrollController;
use App\Modules\Projects\Http\ProjectController;
use App\Modules\Tasks\Http\TaskController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('tenant')->group(function () {
    // Public
    Route::post('/auth/register', RegisterController::class)->middleware('throttle:10,1');
    Route::post('/auth/login', [LoginController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/auth/two-factor', [TwoFactorController::class, 'challenge'])->middleware('throttle:10,1');
    Route::get('/auth/oauth/{provider}/redirect', [OAuthController::class, 'redirect'])->middleware('throttle:20,1');
    Route::get('/auth/oauth/{provider}/callback', [OAuthController::class, 'callback'])->middleware('throttle:20,1');
    Route::post('/auth/oauth/exchange', [OAuthController::class, 'exchange'])->middleware('throttle:10,1');

    // Authenticated
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/auth/logout', [LoginController::class, 'logout']);
        Route::get('/me', [MeController::class, 'show']);
        Route::get('/me/bootstrap', [MeController::class, 'bootstrap']);
        Route::post('/me/two-factor/enable', [TwoFactorController::class, 'enable']);
        Route::post('/me/two-factor/confirm', [TwoFactorController::class, 'confirm']);
        Route::post('/me/two-factor/disable', [TwoFactorController::class, 'disable']);

        Route::get('/modules', [ModuleController::class, 'index']);
        Route::patch('/modules/{key}', [ModuleController::class, 'update']);

        // Lightweight people picker for assignees/sharing.
        Route::get('/users', fn (\Illuminate\Http\Request $request) => response()->json([
            'data' => \App\Models\User::query()
                ->where('tenant_id', $request->user()->tenant_id)
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'email']),
        ]));

        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);

        // Dashboard module
        Route::prefix('dashboard')->middleware('module:dashboard')->group(function () {
            Route::get('/summary', [DashboardController::class, 'summary']);
            Route::get('/activity', [DashboardController::class, 'activity']);
        });

        // HR module
        Route::prefix('hr')->middleware('module:hr')->group(function () {
            Route::get('/employees', [EmployeeController::class, 'index']);
            Route::post('/employees', [EmployeeController::class, 'store']);
            Route::get('/employees/{employee:public_id}', [EmployeeController::class, 'show']);
            Route::patch('/employees/{employee:public_id}', [EmployeeController::class, 'update']);
            Route::delete('/employees/{employee:public_id}', [EmployeeController::class, 'destroy']);

            Route::apiResource('departments', DepartmentController::class)->except(['show']);

            Route::post('/attendance/clock-in', [AttendanceController::class, 'clockIn']);
            Route::post('/attendance/clock-out', [AttendanceController::class, 'clockOut']);
            Route::get('/attendance', [AttendanceController::class, 'index']);
            Route::get('/attendance/today', [AttendanceController::class, 'today']);

            Route::get('/leave-types', [LeaveController::class, 'types']);
            Route::get('/leave-requests', [LeaveController::class, 'index']);
            Route::post('/leave-requests', [LeaveController::class, 'store']);
            Route::post('/leave-requests/{leaveRequest}/approve', [LeaveController::class, 'approve']);
            Route::post('/leave-requests/{leaveRequest}/reject', [LeaveController::class, 'reject']);
            Route::get('/leave-balances', [LeaveController::class, 'balances']);

            Route::get('/payroll/runs', [PayrollController::class, 'index']);
            Route::post('/payroll/runs', [PayrollController::class, 'store']);
            Route::get('/payroll/runs/{payrollRun}', [PayrollController::class, 'show']);
            Route::post('/payroll/runs/{payrollRun}/approve', [PayrollController::class, 'approve']);
            Route::post('/payroll/runs/{payrollRun}/publish', [PayrollController::class, 'publish']);
            Route::get('/payroll/runs/{payrollRun}/bank-export', [PayrollController::class, 'bankExport']);
            Route::patch('/payroll/runs/{payrollRun}/items/{payrollItem}', [PayrollController::class, 'adjustItem']);
            Route::get('/payslips/mine', [PayrollController::class, 'myPayslips']);
            Route::get('/payslips/{payrollItem}/download', [PayrollController::class, 'downloadPayslip']);
        });

        // Projects module
        Route::middleware('module:projects')->group(function () {
            Route::apiResource('projects', ProjectController::class);
        });

        // Documents module
        Route::middleware('module:documents')->group(function () {
            Route::get('/documents', [DocumentController::class, 'index']);
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::get('/documents/{document}/download', [DocumentController::class, 'download']);
            Route::patch('/documents/{document}', [DocumentController::class, 'update']);
            Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);
            Route::post('/documents/{document}/share', [DocumentController::class, 'share']);
            Route::post('/folders', [FolderController::class, 'store']);
            Route::patch('/folders/{folder}', [FolderController::class, 'update']);
            Route::delete('/folders/{folder}', [FolderController::class, 'destroy']);
        });

        // CRM module
        Route::prefix('crm')->middleware('module:crm')->group(function () {
            Route::get('/leads', [CrmController::class, 'leads']);
            Route::post('/leads', [CrmController::class, 'storeLead']);
            Route::patch('/leads/{lead}', [CrmController::class, 'updateLead']);
            Route::post('/leads/{lead}/convert', [CrmController::class, 'convertLead']);
            Route::get('/clients', [CrmController::class, 'clients']);
            Route::post('/clients', [CrmController::class, 'storeClient']);
            Route::get('/deals', [CrmController::class, 'deals']);
            Route::post('/deals', [CrmController::class, 'storeDeal']);
            Route::patch('/deals/{deal}', [CrmController::class, 'updateDeal']);
            Route::get('/activities', [CrmController::class, 'activities']);
            Route::post('/activities', [CrmController::class, 'storeActivity']);
        });

        // Finance module
        Route::prefix('finance')->middleware('module:finance')->group(function () {
            Route::get('/summary', [FinanceController::class, 'summary']);
            Route::get('/categories', [FinanceController::class, 'categories']);
            Route::post('/categories', [FinanceController::class, 'storeCategory']);
            Route::get('/transactions', [FinanceController::class, 'transactions']);
            Route::post('/transactions', [FinanceController::class, 'storeTransaction']);
            Route::post('/transactions/{transaction}/{decision}', [FinanceController::class, 'decideTransaction'])
                ->whereIn('decision', ['approve', 'reject']);
            Route::get('/invoices', [FinanceController::class, 'invoices']);
            Route::post('/invoices', [FinanceController::class, 'storeInvoice']);
            Route::get('/invoices/{invoice}', [FinanceController::class, 'showInvoice']);
            Route::post('/invoices/{invoice}/send', [FinanceController::class, 'sendInvoice']);
            Route::post('/invoices/{invoice}/payments', [FinanceController::class, 'recordPayment']);
        });

        // Chat module
        Route::prefix('chat')->middleware('module:chat')->group(function () {
            Route::get('/conversations', [ChatController::class, 'conversations']);
            Route::post('/conversations', [ChatController::class, 'store']);
            Route::get('/conversations/{conversation}/messages', [ChatController::class, 'messages']);
            Route::post('/conversations/{conversation}/messages', [ChatController::class, 'send']);
            Route::post('/conversations/{conversation}/read', [ChatController::class, 'markRead']);
        });

        // Tasks module
        Route::prefix('tasks')->middleware('module:tasks')->group(function () {
            Route::get('/', [TaskController::class, 'index']);
            Route::post('/', [TaskController::class, 'store']);
            Route::patch('/{task}', [TaskController::class, 'update']);
            Route::delete('/{task}', [TaskController::class, 'destroy']);
            Route::get('/{task}/comments', [TaskController::class, 'comments']);
            Route::post('/{task}/comments', [TaskController::class, 'addComment']);
        });
    });
});
