"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, destroy, get, patch, post } from "@/lib/api";

/* ── Types mirroring the API contracts ─────────────────────────── */

export type Bootstrap = {
  user: { id: number; name: string; email: string };
  tenant: {
    id: number;
    name: string;
    subdomain: string;
    status: string;
    branding: {
      display_name?: string;
      primary_color?: string;
      accent_color?: string;
      logo_path?: string;
    } | null;
  } | null;
  modules: { key: string; name: string; enabled: boolean }[];
  subscription: {
    state: "active" | "trial" | "expired" | "complimentary";
    plan_key: string | null;
    plan_name: string | null;
    trial_ends_at: string | null;
    subscription_ends_at: string | null;
  } | null;
  permissions: string[];
};

export type DashboardSummary = {
  total_staff: number;
  new_this_month: number;
  departments: number;
  attendance_today: { present: number; late: number; absent: number };
  pending_leave: number;
  birthdays_this_month: number;
};

export type ActivityEntry = {
  id: number;
  actor: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  at: string;
};

export type EmployeeRow = {
  id: string;
  employee_id: number;
  employee_code: string;
  account_status: "invited" | "active" | "disabled" | null;
  name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  department_id: number | null;
  position: string | null;
  position_id: number | null;
  manager: string | null;
  manager_id: number | null;
  profile_percent: number;
  employment_type: string;
  status: string;
  hired_at: string | null;
};

export type DepartmentRow = {
  id: number;
  name: string;
  code: string | null;
  manager_id: number | null;
  manager: string | null;
  employees_count: number;
};

export type LeaveRow = {
  id: number;
  employee: string | null;
  type: string | null;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

export type LeaveBalanceRow = { type: string; entitled: number; used: number; remaining: number };

export type LeaveTypeRow = { id: number; name: string; days_per_year: number };

export type AttendanceRow = {
  id: number;
  employee: string | null;
  office: string | null;
  work_date: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  method: string;
  is_late: boolean;
  minutes_late: number;
  left_early: boolean;
};

export type AttendanceToday = {
  summary: { present: number; late: number };
  records: AttendanceRow[];
};

/* ── Session & dashboard ───────────────────────────────────────── */

export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => get<Bootstrap>("/me/bootstrap").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => get<DashboardSummary>("/dashboard/summary").then((r) => r.data),
  });
}

/**
 * Same endpoint as useDashboardSummary — the API returns personal figures
 * instead of company ones when the caller cannot see company data.
 */
export type MyDashboard = {
  has_employee_record: boolean;
  clocked_in: boolean;
  clocked_in_at: string | null;
  is_late_today?: boolean;
  leave_pending: number;
  leave_taken_this_year: number;
  profile_percent: number;
  open_tasks: number;
};

export function useMyDashboard() {
  return useQuery({
    queryKey: ["dashboard", "summary", "personal"],
    queryFn: () => get<MyDashboard>("/dashboard/summary").then((r) => r.data),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => get<ActivityEntry[]>("/dashboard/activity").then((r) => r.data),
  });
}

/* ── HR: employees & departments ───────────────────────────────── */

export function useEmployees(search: string) {
  const params = search ? `?q=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["employees", search],
    queryFn: () => get<EmployeeRow[]>(`/hr/employees${params}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => get<DepartmentRow[]>("/hr/departments").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export type PositionRow = {
  id: number;
  title: string;
  level: string | null;
  department_id: number | null;
  department: string | null;
  employees_count: number;
};

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: () => get<PositionRow[]>("/hr/positions").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useSavePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: number; title: string; level?: string | null; department_id?: number | null }) =>
      (id
        ? patch<PositionRow>(`/hr/positions/${id}`, payload)
        : post<PositionRow>("/hr/positions", payload)
      ).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions"] }),
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/hr/positions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions"] }),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      patch<EmployeeRow>(`/hr/employees/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSaveDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: number; name: string; code?: string | null; manager_id?: number | null }) =>
      (id
        ? patch<DepartmentRow>(`/hr/departments/${id}`, payload)
        : post<DepartmentRow>("/hr/departments", payload)
      ).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/hr/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post("/hr/employees", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/* ── HR: leave ─────────────────────────────────────────────────── */

export function useLeaveRequests() {
  return useQuery({
    queryKey: ["leave", "requests"],
    queryFn: () => get<LeaveRow[]>("/hr/leave-requests").then((r) => r.data),
  });
}

export function usePendingLeave() {
  return useQuery({
    queryKey: ["leave", "pending"],
    queryFn: () => get<LeaveRow[]>("/hr/leave-requests?filter.status=pending").then((r) => r.data),
  });
}

export function useLeaveBalances() {
  return useQuery({
    queryKey: ["leave", "balances"],
    queryFn: () => get<LeaveBalanceRow[]>("/hr/leave-balances").then((r) => r.data),
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ["leave", "types"],
    queryFn: () => get<LeaveTypeRow[]>("/hr/leave-types").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useSubmitLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { leave_type_id: number; start_date: string; end_date: string; reason?: string }) =>
      post("/hr/leave-requests", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave"] }),
  });
}

export function useDecideLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "approve" | "reject" }) =>
      post(`/hr/leave-requests/${id}/${decision}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/* ── HR: attendance ────────────────────────────────────────────── */

export function useAttendanceToday() {
  return useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => get<AttendanceToday>("/hr/attendance/today").then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { method: "gps" | "qr" | "web"; latitude?: number; longitude?: number }) =>
      post("/hr/attendance/clock-in", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => post("/hr/attendance/clock-out"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

/* ── HR: payroll ───────────────────────────────────────────────── */

export type PayrollRunRow = {
  id: number;
  period: string;
  status: "draft" | "approved" | "published";
  employees: number | null;
  gross_total: number;
  net_total: number;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
};

export type PayrollItemRow = {
  id: number;
  employee: string | null;
  employee_code: string | null;
  basic: number;
  allowances: Record<string, number> | null;
  bonuses: Record<string, number> | null;
  deductions: Record<string, number> | null;
  has_payslip: boolean;
  gross: number;
  pension_employee: number;
  paye_tax: number;
  net: number;
};

export type PayrollRunDetail = PayrollRunRow & { items: PayrollItemRow[] };

export type PayslipRow = PayrollItemRow & { period: string; published_at: string | null };

export type BankExportRow = {
  employee_code: string;
  employee: string;
  bank_name: string | null;
  account_number: string | null;
  amount: number;
  narration: string;
};

export function usePayrollRuns() {
  return useQuery({
    queryKey: ["payroll", "runs"],
    queryFn: () => get<PayrollRunRow[]>("/hr/payroll/runs").then((r) => r.data),
  });
}

export function usePayrollRun(id: number | null) {
  return useQuery({
    queryKey: ["payroll", "run", id],
    queryFn: () => get<PayrollRunDetail>(`/hr/payroll/runs/${id}`).then((r) => r.data),
    enabled: id !== null,
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => post<PayrollRunRow>("/hr/payroll/runs", { period }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });
}

export function usePayrollAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "publish" }) =>
      post<PayrollRunRow>(`/hr/payroll/runs/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });
}

export function useBankExport() {
  return useMutation({
    mutationFn: (id: number) => get<BankExportRow[]>(`/hr/payroll/runs/${id}/bank-export`).then((r) => r.data),
  });
}

export function useMyPayslips() {
  return useQuery({
    queryKey: ["payroll", "payslips"],
    queryFn: () => get<PayslipRow[]>("/hr/payslips/mine").then((r) => r.data),
  });
}

export function useAdjustPayrollItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      itemId,
      bonuses,
      deductions,
    }: {
      runId: number;
      itemId: number;
      bonuses: Record<string, number>;
      deductions: Record<string, number>;
    }) => patch<PayrollItemRow>(`/hr/payroll/runs/${runId}/items/${itemId}`, { bonuses, deductions }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  });
}

/* ── Projects & tasks ──────────────────────────────────────────── */

export type ProjectRow = {
  id: number;
  name: string;
  status: "active" | "on_hold" | "completed" | "archived";
  color: string;
  starts_on: string | null;
  due_on: string | null;
  budget: number | null;
  tasks_count: number;
  done_tasks_count: number;
  members: { id: number; name: string }[];
};

export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  position: number;
  project: { id: number; name: string; color: string } | null;
  assignees: { id: number; name: string }[];
  comments_count: number;
  completed_at: string | null;
};

export type TaskCommentRow = { id: number; author: string | null; body: string; at: string };

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => get<ProjectRow[]>("/projects").then((r) => r.data),
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => get<ProjectRow & { description: string | null }>(`/projects/${id}`).then((r) => r.data),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; due_on?: string }) =>
      post<ProjectRow>("/projects", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useTasks(params: { projectId?: number; mine?: boolean }) {
  const search = new URLSearchParams();
  if (params.projectId) search.set("filter.project_id", String(params.projectId));
  if (params.mine) search.set("mine", "1");
  const qs = search.toString() ? `?${search.toString()}` : "";

  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => get<TaskRow[]>(`/tasks${qs}`).then((r) => r.data),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post<TaskRow>("/tasks", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Kanban move / edit with optimistic column update. */
export function useUpdateTask(listKey: { projectId?: number; mine?: boolean }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      patch<TaskRow>(`/tasks/${id}`, payload),
    onMutate: async ({ id, ...payload }) => {
      const key = ["tasks", listKey];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskRow[]>(key);
      queryClient.setQueryData<TaskRow[]>(key, (old) =>
        old?.map((t) => (t.id === id ? ({ ...t, ...payload } as TaskRow) : t)),
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useTaskComments(taskId: number | null) {
  return useQuery({
    queryKey: ["tasks", "comments", taskId],
    queryFn: () => get<TaskCommentRow[]>(`/tasks/${taskId}/comments`).then((r) => r.data),
    enabled: taskId !== null,
  });
}

export function useAddTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: string }) =>
      post<TaskCommentRow>(`/tasks/${taskId}/comments`, { body }),
    onSuccess: (_res, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/* ── Notifications ─────────────────────────────────────────────── */

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  url: string;
  kind: "task" | "leave" | "payroll" | "system";
  read: boolean;
  at: string;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      get<{ unread_count: number; notifications: NotificationRow[] }>("/notifications").then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/* ── Documents ─────────────────────────────────────────────────── */

export type FolderRow = { id: number; name: string; parent_id: number | null; items: number };

export type DocumentRow = {
  id: number;
  name: string;
  folder_id: number | null;
  mime: string | null;
  size_bytes: number;
  visibility: "tenant" | "private";
  uploaded_by: string | null;
  created_at: string;
};

export type DocumentListing = {
  folders: FolderRow[];
  documents: DocumentRow[];
  breadcrumbs: { id: number; name: string }[];
};

export type UserRow = { id: number; name: string; email: string };

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => get<UserRow[]>("/users").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useDocuments(folderId: number | null, search: string) {
  const params = new URLSearchParams();
  if (folderId) params.set("folder_id", String(folderId));
  if (search) params.set("q", search);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["documents", folderId, search],
    queryFn: () => get<DocumentListing>(`/documents${qs}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, folderId, visibility }: { file: File; folderId: number | null; visibility: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folder_id", String(folderId));
      form.append("visibility", visibility);

      const res = await fetch("/api/backend/documents", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const fields = json?.errors as Record<string, string[]> | undefined;
        throw new ApiError(
          res.status,
          json?.error?.code ?? "UPLOAD_FAILED",
          json?.error?.message ?? (fields ? Object.values(fields)[0]?.[0] : undefined) ?? "Upload failed.",
        );
      }
      return json.data as DocumentRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parent_id: number | null }) => post<FolderRow>("/folders", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useShareDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) =>
      post(`/documents/${id}/share`, { user_ids: userIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

/* ── Chat ──────────────────────────────────────────────────────── */

export type ConversationRow = {
  id: number;
  type: "direct" | "group";
  name: string;
  participants: { id: number; name: string }[];
  last_message: { author: string | null; body: string; at: string } | null;
  unread: number;
};

export type MessageRow = {
  id: number;
  conversation_id: number;
  author: string | null;
  author_id: number;
  body: string;
  at: string;
};

export function useConversations() {
  return useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => get<ConversationRow[]>("/chat/conversations").then((r) => r.data),
    // WebSocket events drive updates; this is only a reconnect fallback.
    refetchInterval: 45_000,
  });
}

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => get<MessageRow[]>(`/chat/conversations/${conversationId}/messages`).then((r) => r.data),
    enabled: conversationId !== null,
    // WebSocket events drive updates; this is only a reconnect fallback.
    refetchInterval: 45_000,
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { type: "direct" | "group"; user_ids: number[]; name?: string }) =>
      post<{ id: number; existing: boolean }>("/chat/conversations", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat"] }),
  });
}

export function useSendMessage(conversationId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      post<MessageRow>(`/chat/conversations/${conversationId}/messages`, { body }),
    onMutate: async (body) => {
      // Optimistic append so sending feels instant.
      const key = ["chat", "messages", conversationId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageRow[]>(key);
      queryClient.setQueryData<MessageRow[]>(key, (old) => [
        ...(old ?? []),
        { id: -Date.now(), conversation_id: conversationId ?? 0, author: "You", author_id: -1, body, at: new Date().toISOString() },
      ]);
      return { previous, key };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post(`/chat/conversations/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] }),
  });
}

/* ── CRM ───────────────────────────────────────────────────────── */

export type LeadRow = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  owner: string | null;
  created_at: string;
};

export type ClientRow = {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  owner: string | null;
  deals_count: number;
  pipeline_value: number;
};

export type DealRow = {
  id: number;
  title: string;
  value: number;
  stage: "qualification" | "proposal" | "negotiation" | "won" | "lost";
  position: number;
  expected_close: string | null;
  closed_at: string | null;
  client: { id: number; name: string; company: string | null } | null;
  owner: string | null;
};

export type DealStats = Record<string, { count: number; value: number }>;

export function useLeads() {
  return useQuery({
    queryKey: ["crm", "leads"],
    queryFn: () => get<LeadRow[]>("/crm/leads").then((r) => r.data),
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["crm", "clients"],
    queryFn: () => get<ClientRow[]>("/crm/clients").then((r) => r.data),
  });
}

export function useDeals() {
  return useQuery({
    queryKey: ["crm", "deals"],
    queryFn: () =>
      get<DealRow[]>("/crm/deals").then((r) => ({
        deals: r.data,
        stats: (r.meta as { stats?: DealStats } | undefined)?.stats ?? {},
      })),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post("/crm/leads", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dealTitle, dealValue }: { id: number; dealTitle?: string; dealValue?: number }) =>
      post(`/crm/leads/${id}/convert`, { deal_title: dealTitle, deal_value: dealValue }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post("/crm/clients", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post<DealRow>("/crm/deals", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm"] }),
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      patch<DealRow>(`/crm/deals/${id}`, payload),
    onMutate: async ({ id, ...payload }) => {
      const key = ["crm", "deals"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ deals: DealRow[]; stats: DealStats }>(key);
      queryClient.setQueryData<{ deals: DealRow[]; stats: DealStats }>(key, (old) =>
        old
          ? { ...old, deals: old.deals.map((d) => (d.id === id ? ({ ...d, ...payload } as DealRow) : d)) }
          : old,
      );
      return { previous, key };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["crm"] }),
  });
}

/* ── Finance ───────────────────────────────────────────────────── */

export type FinanceSummary = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  outstanding_invoices: number;
  pending_expenses: number;
};

export type TransactionRow = {
  id: number;
  kind: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  occurred_on: string;
  status: "pending" | "approved" | "rejected";
  created_by: string | null;
};

export type InvoiceRow = {
  id: number;
  number: string;
  client: string | null;
  status: "draft" | "sent" | "partial" | "paid" | "overdue";
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  total: number;
  paid_amount: number;
};

export function useFinanceSummary() {
  return useQuery({
    queryKey: ["finance", "summary"],
    queryFn: () => get<FinanceSummary>("/finance/summary").then((r) => r.data),
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["finance", "transactions"],
    queryFn: () => get<TransactionRow[]>("/finance/transactions").then((r) => r.data),
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["finance", "invoices"],
    queryFn: () => get<InvoiceRow[]>("/finance/invoices").then((r) => r.data),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post("/finance/transactions", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useDecideTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "approve" | "reject" }) =>
      post(`/finance/transactions/${id}/${decision}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => post<InvoiceRow>("/finance/invoices", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post(`/finance/invoices/${id}/send`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; amount: number; paid_on: string; method?: string }) =>
      post(`/finance/invoices/${id}/payments`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });
}

/* ── AI Assistant ──────────────────────────────────────────────── */

export type AiStatus = {
  configured: boolean;
  model: string;
  tools: string[];
};

export type AiChatMessage = { role: "user" | "assistant"; content: string };

export type AiChatResponse = {
  reply: string;
  tool_calls: string[];
  usage: { input_tokens: number; output_tokens: number };
};

export type AiGenerateResponse = {
  content: string;
  usage: { input_tokens: number; output_tokens: number };
};

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => get<AiStatus>("/ai/status").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useAiChat() {
  return useMutation({
    mutationFn: (messages: AiChatMessage[]) =>
      post<AiChatResponse>("/ai/chat", { messages }).then((r) => r.data),
  });
}

export function useAiGenerate() {
  return useMutation({
    mutationFn: (payload: { type: string; instructions: string }) =>
      post<AiGenerateResponse>("/ai/generate", payload).then((r) => r.data),
  });
}

/* ── Billing ───────────────────────────────────────────────────── */

export type PlanRow = {
  key: string;
  name: string;
  price: number;
  max_employees: number | null;
  blurb: string;
  features: string[];
};

export type BillingPaymentRow = {
  id: number;
  plan_key: string;
  amount: number;
  reference: string;
  status: "pending" | "paid" | "failed";
  channel: string | null;
  paid_at: string | null;
  by: string | null;
  created_at: string;
};

export type BillingInfo = {
  state: "active" | "trial" | "expired" | "complimentary";
  plan_key: string | null;
  plan_name: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  configured: boolean;
  plans: PlanRow[];
  payments: BillingPaymentRow[];
};

export function useBilling() {
  return useQuery({
    queryKey: ["billing"],
    queryFn: () => get<BillingInfo>("/billing").then((r) => r.data),
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: (plan: string) =>
      post<{ authorization_url: string; reference: string }>("/billing/checkout", { plan }).then(
        (r) => r.data,
      ),
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reference: string) =>
      post<{ activated: boolean }>("/billing/verify", { reference }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

/* ── Help Desk ─────────────────────────────────────────────────── */

export type TicketRow = {
  id: number;
  number: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: string | null;
  requester: string | null;
  requester_id: number;
  assignee: string | null;
  assignee_id: number | null;
  comments_count: number | null;
  created_at: string;
  updated_at: string;
};

export type TicketCommentRow = {
  id: number;
  author: string | null;
  author_id: number;
  body: string;
  is_internal: boolean;
  at: string;
};

export type TicketDetail = TicketRow & { comments: TicketCommentRow[] };

export function useTickets(status?: string) {
  const params = status ? `?filter.status=${status}` : "";
  return useQuery({
    queryKey: ["helpdesk", "tickets", status ?? "all"],
    queryFn: () =>
      get<TicketRow[]>(`/helpdesk/tickets${params}`).then((r) => ({
        tickets: r.data,
        isAgent: Boolean((r.meta as { is_agent?: boolean } | undefined)?.is_agent),
      })),
  });
}

export function useTicket(id: number | null) {
  return useQuery({
    queryKey: ["helpdesk", "ticket", id],
    queryFn: () => get<TicketDetail>(`/helpdesk/tickets/${id}`).then((r) => r.data),
    enabled: id !== null,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { subject: string; description: string; priority?: string; category?: string }) =>
      post<TicketRow>("/helpdesk/tickets", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; status?: string; priority?: string; assignee_id?: number | null }) =>
      patch<TicketRow>(`/helpdesk/tickets/${id}`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
}

export function useAddTicketComment(ticketId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; is_internal?: boolean }) =>
      post<TicketCommentRow>(`/helpdesk/tickets/${ticketId}/comments`, payload).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["helpdesk", "ticket", ticketId] }),
  });
}

/* ── Knowledge Base ────────────────────────────────────────────── */

export type ArticleRow = {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  status: "draft" | "published";
  author: string | null;
  excerpt: string;
  views: number;
  published_at: string | null;
  updated_at: string;
};

export type ArticleDetail = ArticleRow & { body: string };

export function useArticles(search: string) {
  const params = search ? `?q=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["knowledge", "articles", search],
    queryFn: () =>
      get<ArticleRow[]>(`/knowledge/articles${params}`).then((r) => ({
        articles: r.data,
        isEditor: Boolean((r.meta as { is_editor?: boolean } | undefined)?.is_editor),
      })),
    placeholderData: (prev) => prev,
  });
}

export function useArticle(slug: string | null) {
  return useQuery({
    queryKey: ["knowledge", "article", slug],
    queryFn: () => get<ArticleDetail>(`/knowledge/articles/${slug}`).then((r) => r.data),
    enabled: slug !== null,
  });
}

export function useSaveArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: number; title: string; body: string; category?: string | null }) =>
      (id
        ? patch<ArticleDetail>(`/knowledge/articles/${id}`, payload)
        : post<ArticleRow>("/knowledge/articles", payload)
      ).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

export function useSetArticlePublished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, publish }: { id: number; publish: boolean }) =>
      post<ArticleRow>(`/knowledge/articles/${id}/${publish ? "publish" : "unpublish"}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/knowledge/articles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });
}

/* ── Calendar ──────────────────────────────────────────────────── */

export type CalendarEventRow = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  kind: "meeting" | "reminder" | "deadline" | "company";
  organizer: string | null;
  is_organizer: boolean;
  my_response: "pending" | "accepted" | "declined" | null;
  attendees: { id: number; name: string; response: string }[];
};

export function useCalendarEvents(from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () =>
      get<CalendarEventRow[]>(`/calendar/events?from=${from}&to=${to}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<CalendarEventRow>("/calendar/events", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/calendar/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useRsvpEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: number; response: "accepted" | "declined" }) =>
      post<CalendarEventRow>(`/calendar/events/${id}/respond`, { response }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

/* ── Recruitment ───────────────────────────────────────────────── */

export type OpeningRow = {
  id: number;
  title: string;
  department: string | null;
  department_id: number | null;
  employment_type: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  openings_count: number;
  applicants_count: number | null;
  created_at: string;
};

export type ApplicantRow = {
  id: number;
  opening_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
  rating: number | null;
  notes: string | null;
  hired: boolean;
  created_at: string;
};

export function useOpenings() {
  return useQuery({
    queryKey: ["recruitment", "openings"],
    queryFn: () => get<OpeningRow[]>("/hr/recruitment/openings").then((r) => r.data),
  });
}

export function useApplicants(openingId: number | null) {
  return useQuery({
    queryKey: ["recruitment", "applicants", openingId],
    queryFn: () =>
      get<ApplicantRow[]>(`/hr/recruitment/openings/${openingId}/applicants`).then((r) => r.data),
    enabled: openingId !== null,
  });
}

export function useCreateOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<OpeningRow>("/hr/recruitment/openings", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruitment"] }),
  });
}

export function useUpdateOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      patch<OpeningRow>(`/hr/recruitment/openings/${id}`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruitment"] }),
  });
}

export function useAddApplicant(openingId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<ApplicantRow>(`/hr/recruitment/openings/${openingId}/applicants`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recruitment"] }),
  });
}

export function useUpdateApplicant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; stage?: string; rating?: number | null; notes?: string }) =>
      patch<ApplicantRow>(`/hr/recruitment/applicants/${id}`, payload).then((r) => r.data),
    onMutate: async ({ id, stage }) => {
      // Optimistic stage move for the pipeline board.
      if (!stage) return {};
      const key = ["recruitment", "applicants"];
      await queryClient.cancelQueries({ queryKey: key });
      const snapshots = queryClient.getQueriesData<ApplicantRow[]>({ queryKey: key });
      for (const [qk, rows] of snapshots) {
        if (rows) {
          queryClient.setQueryData(
            qk,
            rows.map((row) => (row.id === id ? { ...row, stage: stage as ApplicantRow["stage"] } : row)),
          );
        }
      }
      return { snapshots };
    },
    onError: (_e, _v, context) => {
      for (const [qk, rows] of context?.snapshots ?? []) queryClient.setQueryData(qk, rows);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["recruitment"] }),
  });
}

export function useHireApplicant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_code }: { id: number; employee_code: string }) =>
      post<ApplicantRow & { employee_public_id: string }>(`/hr/recruitment/applicants/${id}/hire`, {
        employee_code,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

/* ── Performance (OKRs) ────────────────────────────────────────── */

export type KeyResultRow = {
  id: number;
  title: string;
  target_value: number;
  current_value: number;
  unit: string | null;
  completion: number;
};

export type ObjectiveRow = {
  id: number;
  title: string;
  description: string | null;
  period: string;
  status: "active" | "completed" | "cancelled";
  employee: string | null;
  employee_id: number;
  progress: number;
  key_results: KeyResultRow[];
  created_at: string;
};

export function useObjectives(scope: "mine" | "team") {
  return useQuery({
    queryKey: ["performance", scope],
    queryFn: () =>
      get<ObjectiveRow[]>(`/hr/performance/objectives?scope=${scope}`).then((r) => ({
        objectives: r.data,
        canViewAll: Boolean((r.meta as { can_view_all?: boolean } | undefined)?.can_view_all),
        canManage: Boolean((r.meta as { can_manage?: boolean } | undefined)?.can_manage),
      })),
  });
}

export function useCreateObjective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<ObjectiveRow>("/hr/performance/objectives", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["performance"] }),
  });
}

export function useUpdateObjective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; status?: string; title?: string }) =>
      patch<ObjectiveRow>(`/hr/performance/objectives/${id}`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["performance"] }),
  });
}

export function useCheckInKeyResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, current_value }: { id: number; current_value: number }) =>
      patch<ObjectiveRow>(`/hr/performance/key-results/${id}`, { current_value }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["performance"] }),
  });
}

/* ── Inventory ─────────────────────────────────────────────────── */

export type InventoryItemRow = {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  quantity: number;
  reorder_level: number;
  unit_cost: number | null;
  location: string | null;
  low_stock: boolean;
  updated_at: string;
};

export type StockMovementRow = {
  id: number;
  kind: "in" | "out" | "adjust";
  quantity: number;
  note: string | null;
  by: string | null;
  at: string;
};

export type InventoryMeta = { total_items: number; low_stock: number; stock_value: number };

export function useInventory(search: string) {
  const params = search ? `?q=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["inventory", search],
    queryFn: () =>
      get<InventoryItemRow[]>(`/inventory/items${params}`).then((r) => ({
        items: r.data,
        meta: (r.meta ?? { total_items: 0, low_stock: 0, stock_value: 0 }) as InventoryMeta,
      })),
    placeholderData: (prev) => prev,
  });
}

export function useItemMovements(itemId: number | null) {
  return useQuery({
    queryKey: ["inventory", "movements", itemId],
    queryFn: () => get<StockMovementRow[]>(`/inventory/items/${itemId}/movements`).then((r) => r.data),
    enabled: itemId !== null,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<InventoryItemRow>("/inventory/items", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useMoveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; kind: string; quantity: number; note?: string }) =>
      post<InventoryItemRow>(`/inventory/items/${id}/movements`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

/* ── LMS ───────────────────────────────────────────────────────── */

export type CourseRow = {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: "draft" | "published";
  lessons_count: number;
  enrollments_count: number | null;
  enrolled: boolean;
  progress: number;
  completed: boolean;
  published_at: string | null;
};

export type LessonRow = {
  id: number;
  title: string;
  content: string;
  position: number;
  duration_minutes: number | null;
  completed: boolean;
};

export type CourseDetail = CourseRow & { lessons: LessonRow[] };

export function useCourses() {
  return useQuery({
    queryKey: ["lms", "courses"],
    queryFn: () =>
      get<CourseRow[]>("/lms/courses").then((r) => ({
        courses: r.data,
        isManager: Boolean((r.meta as { is_manager?: boolean } | undefined)?.is_manager),
      })),
  });
}

export function useCourse(id: number | null) {
  return useQuery({
    queryKey: ["lms", "course", id],
    queryFn: () => get<CourseDetail>(`/lms/courses/${id}`).then((r) => r.data),
    enabled: id !== null,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<CourseRow>("/lms/courses", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lms"] }),
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number; status?: string; title?: string }) =>
      patch<CourseRow>(`/lms/courses/${id}`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lms"] }),
  });
}

export function useAddLesson(courseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; content: string; duration_minutes?: number }) =>
      post(`/lms/courses/${courseId}/lessons`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lms"] }),
  });
}

export function useEnroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: number) => post<CourseRow>(`/lms/courses/${courseId}/enroll`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lms"] }),
  });
}

export function useCompleteLesson(courseId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: number) =>
      post<{ progress: number; course_completed: boolean }>(`/lms/lessons/${lessonId}/complete`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms", "course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["lms", "courses"] });
    },
  });
}

/* ── HR lifecycle: onboarding, assets, exits ───────────────────── */

export type OnboardingTaskRow = {
  id: number;
  title: string;
  status: "pending" | "done";
  assignee: string | null;
  due_date: string | null;
  completed_at: string | null;
};

export type OnboardingSummaryRow = {
  employee_id: number;
  employee: string | null;
  public_id: string | null;
  total: number;
  done: number;
  progress: number;
};

export type OnboardingDetail = { employee: string; progress: number; tasks: OnboardingTaskRow[] };

export type AssetRow = {
  id: number;
  name: string;
  tag: string;
  category: string;
  serial_number: string | null;
  status: "available" | "assigned" | "maintenance" | "retired";
  assigned_to: string | null;
  assigned_employee_id: number | null;
  assigned_at: string | null;
  notes: string | null;
};

export type AssetHistoryRow = {
  id: number;
  employee: string | null;
  assigned_at: string;
  returned_at: string | null;
  condition_note: string | null;
};

export type ExitTaskRow = { id: number; title: string; status: "pending" | "done" };

export type ExitRow = {
  id: number;
  employee: string | null;
  employee_id: number;
  reason: string;
  notice_date: string | null;
  last_working_day: string;
  status: "clearance" | "completed" | "cancelled";
  notes: string | null;
  progress: number;
  tasks: ExitTaskRow[];
  created_at: string;
};

export function useOnboardingIndex() {
  return useQuery({
    queryKey: ["lifecycle", "onboarding"],
    queryFn: () => get<OnboardingSummaryRow[]>("/hr/onboarding").then((r) => r.data),
  });
}

export function useOnboardingDetail(publicId: string | null) {
  return useQuery({
    queryKey: ["lifecycle", "onboarding", publicId],
    queryFn: () => get<OnboardingDetail>(`/hr/employees/${publicId}/onboarding`).then((r) => r.data),
    enabled: publicId !== null,
  });
}

export function useStartOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) =>
      post<OnboardingDetail>(`/hr/employees/${publicId}/onboarding/start`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle"] }),
  });
}

export function useToggleOnboardingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => patch(`/hr/onboarding-tasks/${taskId}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle"] }),
  });
}

export function useAssets(search: string) {
  const params = search ? `?q=${encodeURIComponent(search)}` : "";
  return useQuery({
    queryKey: ["lifecycle", "assets", search],
    queryFn: () =>
      get<AssetRow[]>(`/hr/assets${params}`).then((r) => ({
        assets: r.data,
        meta: (r.meta ?? {}) as { total?: number; assigned?: number; available?: number },
      })),
    placeholderData: (prev) => prev,
  });
}

export function useAssetHistory(assetId: number | null) {
  return useQuery({
    queryKey: ["lifecycle", "asset-history", assetId],
    queryFn: () => get<AssetHistoryRow[]>(`/hr/assets/${assetId}/history`).then((r) => r.data),
    enabled: assetId !== null,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<AssetRow>("/hr/assets", payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle"] }),
  });
}

export function useAssignAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_id }: { id: number; employee_id: number }) =>
      post<AssetRow>(`/hr/assets/${id}/assign`, { employee_id }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle"] }),
  });
}

export function useReturnAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, condition_note }: { id: number; condition_note?: string }) =>
      post<AssetRow>(`/hr/assets/${id}/return`, { condition_note }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle"] }),
  });
}

export function useExits() {
  return useQuery({
    queryKey: ["lifecycle", "exits"],
    queryFn: () => get<ExitRow[]>("/hr/exits").then((r) => r.data),
  });
}

export function useInitiateExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, ...payload }: { publicId: string; reason: string; last_working_day: string; notice_date?: string; notes?: string }) =>
      post<ExitRow>(`/hr/employees/${publicId}/exits`, payload).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle"] }),
  });
}

export function useToggleExitTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => patch<ExitRow>(`/hr/exit-tasks/${taskId}/toggle`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lifecycle", "exits"] }),
  });
}

export function useCompleteExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exitId: number) => post<ExitRow>(`/hr/exits/${exitId}/complete`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lifecycle"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

/* ── Workspace settings: branding + roles ──────────────────────── */

export type BrandingInfo = {
  display_name: string | null;
  primary_color: string | null;
  accent_color: string | null;
  has_logo: boolean;
};

export function useBranding() {
  return useQuery({
    queryKey: ["settings", "branding"],
    queryFn: () => get<BrandingInfo>("/settings/branding").then((r) => r.data),
  });
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<BrandingInfo>) =>
      patch<BrandingInfo>("/settings/branding", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "branding"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch("/api/backend/settings/branding/logo", { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiError(res.status, json?.error?.code ?? "UPLOAD_FAILED", json?.error?.message ?? "Upload failed.");
      }
      return json.data as BrandingInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "branding"] });
      queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export type RoleRow = {
  id: number;
  key: string;
  name: string;
  is_system: boolean;
  permissions: string[];
  members: number;
};

export type PermissionRow = { key: string; label: string; group: string };

export type MemberRow = {
  id: number;
  name: string;
  email: string;
  roles: { id: number; key: string; name: string }[];
};

export function useRoles() {
  return useQuery({
    queryKey: ["settings", "roles"],
    queryFn: () => get<RoleRow[]>("/settings/roles").then((r) => r.data),
  });
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ["settings", "permissions"],
    queryFn: () => get<PermissionRow[]>("/settings/permissions").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useSaveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: number; name: string; permissions: string[] }) =>
      (id ? patch<RoleRow>(`/settings/roles/${id}`, payload) : post<RoleRow>("/settings/roles", payload)).then(
        (r) => r.data,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy(`/settings/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["settings", "members"],
    queryFn: () => get<MemberRow[]>("/settings/users").then((r) => r.data),
  });
}

export function useAssignRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role_ids }: { userId: number; role_ids: number[] }) =>
      patch(`/settings/users/${userId}/roles`, { role_ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "members"] }),
  });
}

/* ── Dashboard charts ──────────────────────────────────────────── */

export type DashboardCharts = {
  attendance: { day: string; rate: number; present: number }[];
  headcount: { department: string; count: number }[];
  active_staff: number;
};

export function useDashboardCharts() {
  return useQuery({
    queryKey: ["dashboard", "charts"],
    queryFn: () => get<DashboardCharts>("/dashboard/charts").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useInviteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) =>
      post<{ invited: boolean; email: string; setup_url: string }>(
        `/hr/employees/${publicId}/invite`,
      ).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });
}

/* ── Self-service profile & my team ────────────────────────────── */

export type ProfileContact = {
  id: number;
  name: string;
  relationship?: string;
  occupation?: string;
  phone: string;
  address: string | null;
};

export type MyProfile = {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  manager: string | null;
  employment_type: string;
  status: string;
  hired_at: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  nin: string | null;
  bvn: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  pension_pin: string | null;
  emergency_contacts: ProfileContact[];
  guarantors: ProfileContact[];
  completeness: {
    percent: number;
    missing: { key: string; label: string; section: string }[];
    has_emergency_contact: boolean;
    has_guarantor: boolean;
  };
};

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: () => get<MyProfile>("/hr/me/profile").then((r) => r.data),
    retry: false,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      patch<MyProfile>("/hr/me/profile", payload).then((r) => r.data),
    onSuccess: (data) => queryClient.setQueryData(["my-profile"], data),
  });
}

export function useAddNextOfKin(kind: "emergency-contacts" | "guarantors") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      post<MyProfile>(`/hr/me/profile/${kind}`, payload).then((r) => r.data),
    onSuccess: (data) => queryClient.setQueryData(["my-profile"], data),
  });
}

export function useRemoveNextOfKin(kind: "emergency-contacts" | "guarantors") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => destroy<MyProfile>(`/hr/me/profile/${kind}/${id}`).then((r) => r.data),
    onSuccess: (data) => queryClient.setQueryData(["my-profile"], data),
  });
}

export type TeamMemberRow = {
  id: string;
  employee_id: number;
  name: string;
  employee_code: string;
  email: string | null;
  department: string | null;
  position: string | null;
  status: string;
  account_status: string | null;
  today: "present" | "late" | "absent" | "on_leave";
  clocked_in_at: string | null;
  profile_percent: number;
};

export type TeamMeta = {
  has_employee_record: boolean;
  scope: "all" | "direct_reports";
  team_size: number;
  present_today: number;
  on_leave_today: number;
  pending_leave: number;
  can_approve_leave: boolean;
};

export function useMyTeam(all = false) {
  return useQuery({
    queryKey: ["team", all],
    queryFn: () =>
      get<TeamMemberRow[]>(`/hr/team${all ? "?all=1" : ""}`).then((r) => ({
        team: r.data,
        meta: (r.meta ?? {}) as unknown as TeamMeta,
      })),
  });
}
