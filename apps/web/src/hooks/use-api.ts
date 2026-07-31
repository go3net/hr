"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

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
