<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\ModuleController;
use App\Modules\Dashboard\Http\DashboardController;
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

    // Authenticated
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/auth/logout', [LoginController::class, 'logout']);
        Route::get('/me', [MeController::class, 'show']);
        Route::get('/me/bootstrap', [MeController::class, 'bootstrap']);

        Route::get('/modules', [ModuleController::class, 'index']);
        Route::patch('/modules/{key}', [ModuleController::class, 'update']);

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
