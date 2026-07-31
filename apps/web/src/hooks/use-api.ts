"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, destroy, get, patch, post } from "@/lib/api";

/* ── Types mirroring the API contracts ─────────────────────────── */

export type Bootstrap = {
  user: { id: number; name: string; email: string };
  tenant: { name: string; subdomain: string; status: string; branding: unknown } | null;
  modules: { key: string; name: string; enabled: boolean }[];
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
  employee_code: string;
  name: string;
  email: string | null;
  department: string | null;
  position: string | null;
  employment_type: string;
  status: string;
  hired_at: string | null;
};

export type DepartmentRow = { id: number; name: string; code: string | null; employees_count: number };

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
    refetchInterval: 10_000,
  });
}

export function useMessages(conversationId: number | null) {
  return useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => get<MessageRow[]>(`/chat/conversations/${conversationId}/messages`).then((r) => r.data),
    enabled: conversationId !== null,
    refetchInterval: 4_000,
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
