<?php

namespace App\Modules\Lms\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class LmsController extends ApiController
{
    /** Published courses for everyone; drafts included for lms.manage. */
    public function courses(Request $request): JsonResponse
    {
        $isManager = Gate::allows('permission', ['lms.manage']);

        $enrollmentsByCourse = Enrollment::query()
            ->where('user_id', $request->user()->id)
            ->get()
            ->keyBy('course_id');

        $courses = Course::query()
            ->withCount(['lessons', 'enrollments'])
            ->when(! $isManager, fn ($q) => $q->published())
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (Course $course) => $this->presentCourse($course, $enrollmentsByCourse->get($course->id)));

        return $this->respond($courses, meta: ['is_manager' => $isManager]);
    }

    /** Course detail with lessons and the caller's progress. */
    public function show(Request $request, Course $course): JsonResponse
    {
        $isManager = Gate::allows('permission', ['lms.manage']);
        if ($course->status !== 'published' && ! $isManager) {
            return $this->respondError('NOT_FOUND', 'Course not found.', 404);
        }

        $course->loadCount(['lessons', 'enrollments'])->load('lessons');
        $enrollment = Enrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $request->user()->id)
            ->first();
        $completedIds = $enrollment
            ? $enrollment->completions()->pluck('lesson_id')->all()
            : [];

        return $this->respond([
            ...$this->presentCourse($course, $enrollment),
            'lessons' => $course->lessons->map(fn (Lesson $lesson) => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'content' => $lesson->content,
                'position' => $lesson->position,
                'duration_minutes' => $lesson->duration_minutes,
                'completed' => in_array($lesson->id, $completedIds, true),
            ])->values(),
        ]);
    }

    public function storeCourse(Request $request): JsonResponse
    {
        $this->requirePermission('lms.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:4000'],
            'category' => ['nullable', 'in:'.implode(',', Course::CATEGORIES)],
        ]);

        $course = Course::create([...$data, 'created_by' => $request->user()->id]);
        AuditLog::record('lms.course_created', $course, ['title' => $course->title]);

        return $this->respond($this->presentCourse($course, null), 201);
    }

    public function updateCourse(Request $request, Course $course): JsonResponse
    {
        $this->requirePermission('lms.manage');

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'category' => ['sometimes', 'nullable', 'in:'.implode(',', Course::CATEGORIES)],
            'status' => ['sometimes', 'in:draft,published'],
        ]);

        if (($data['status'] ?? null) === 'published' && $course->status !== 'published') {
            if ($course->lessons()->count() === 0) {
                return $this->respondError('VALIDATION', 'Add at least one lesson before publishing.', 422);
            }
            $data['published_at'] = $course->published_at ?? now();
        }

        $course->update($data);

        return $this->respond($this->presentCourse($course->loadCount(['lessons', 'enrollments']), null));
    }

    public function storeLesson(Request $request, Course $course): JsonResponse
    {
        $this->requirePermission('lms.manage');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string', 'max:60000'],
            'duration_minutes' => ['nullable', 'integer', 'min:1', 'max:600'],
        ]);

        $lesson = $course->lessons()->make([
            ...$data,
            'position' => ($course->lessons()->max('position') ?? 0) + 1,
        ]);
        $lesson->save();

        return $this->respond(['id' => $lesson->id, 'title' => $lesson->title, 'position' => $lesson->position], 201);
    }

    public function enroll(Request $request, Course $course): JsonResponse
    {
        if ($course->status !== 'published') {
            return $this->respondError('VALIDATION', 'This course is not published.', 422);
        }

        $enrollment = Enrollment::query()->firstOrCreate([
            'course_id' => $course->id,
            'user_id' => $request->user()->id,
        ], ['tenant_id' => $course->tenant_id]);

        return $this->respond($this->presentCourse($course->loadCount(['lessons', 'enrollments']), $enrollment), 201);
    }

    public function completeLesson(Request $request, Lesson $lesson): JsonResponse
    {
        $enrollment = Enrollment::query()
            ->where('course_id', $lesson->course_id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $enrollment) {
            return $this->respondError('VALIDATION', 'Enroll in the course first.', 422);
        }

        $enrollment->completions()->firstOrCreate(
            ['lesson_id' => $lesson->id],
            ['tenant_id' => $enrollment->tenant_id],
        );

        // Completing every lesson completes the course.
        $totalLessons = $enrollment->course->lessons()->count();
        $done = $enrollment->completions()->count();
        if ($done >= $totalLessons && $enrollment->completed_at === null) {
            $enrollment->update(['completed_at' => now()]);
        }

        return $this->respond([
            'lesson_id' => $lesson->id,
            'completed_lessons' => $done,
            'total_lessons' => $totalLessons,
            'progress' => $totalLessons > 0 ? (int) round($done / $totalLessons * 100) : 0,
            'course_completed' => $enrollment->fresh()->completed_at !== null,
        ]);
    }

    private function presentCourse(Course $course, ?Enrollment $enrollment): array
    {
        $totalLessons = $course->lessons_count ?? $course->lessons()->count();
        $done = $enrollment ? $enrollment->completions()->count() : 0;

        return [
            'id' => $course->id,
            'title' => $course->title,
            'description' => $course->description,
            'category' => $course->category,
            'status' => $course->status,
            'lessons_count' => $totalLessons,
            'enrollments_count' => $course->enrollments_count ?? null,
            'enrolled' => $enrollment !== null,
            'progress' => $enrollment && $totalLessons > 0 ? (int) round($done / $totalLessons * 100) : 0,
            'completed' => $enrollment?->completed_at !== null,
            'published_at' => $course->published_at?->toIso8601String(),
        ];
    }
}
