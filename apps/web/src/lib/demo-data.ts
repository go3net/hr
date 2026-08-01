/**
 * Demo dataset used until the workspace is connected to a live API.
 * Query hooks fall back to this data when NEXT_PUBLIC_API_URL is unset,
 * so the product is fully explorable out of the box.
 */

export type Employee = {
  id: number;
  name: string;
  code: string;
  email: string;
  department: string;
  position: string;
  employmentType: "Full-time" | "Contract" | "NYSC" | "Intern";
  status: "Active" | "On leave" | "Suspended";
  hiredAt: string;
};

export const employees: Employee[] = [
  { id: 1, name: "Adaeze Okafor", code: "G3N-001", email: "adaeze@go3net.com", department: "Engineering", position: "Engineering Lead", employmentType: "Full-time", status: "Active", hiredAt: "2022-03-14" },
  { id: 2, name: "Tunde Bakare", code: "G3N-002", email: "tunde@go3net.com", department: "People Ops", position: "HR Manager", employmentType: "Full-time", status: "Active", hiredAt: "2021-11-01" },
  { id: 3, name: "Grace Eze", code: "G3N-003", email: "grace@go3net.com", department: "Finance", position: "Finance Officer", employmentType: "Full-time", status: "Active", hiredAt: "2023-01-09" },
  { id: 4, name: "Emeka Nwosu", code: "G3N-004", email: "emeka@go3net.com", department: "Engineering", position: "Backend Engineer", employmentType: "Full-time", status: "On leave", hiredAt: "2023-06-20" },
  { id: 5, name: "Sarah Adeyemi", code: "G3N-005", email: "sarah@go3net.com", department: "Sales", position: "Sales Manager", employmentType: "Full-time", status: "Active", hiredAt: "2022-08-15" },
  { id: 6, name: "David Ojo", code: "G3N-006", email: "david@go3net.com", department: "Engineering", position: "Frontend Engineer", employmentType: "NYSC", status: "Active", hiredAt: "2025-11-03" },
  { id: 7, name: "Fatima Bello", code: "G3N-007", email: "fatima@go3net.com", department: "Design", position: "Product Designer", employmentType: "Full-time", status: "Active", hiredAt: "2024-02-12" },
  { id: 8, name: "Chidi Anyanwu", code: "G3N-008", email: "chidi@go3net.com", department: "Sales", position: "Account Executive", employmentType: "Contract", status: "Active", hiredAt: "2024-09-01" },
  { id: 9, name: "Blessing Umeh", code: "G3N-009", email: "blessing@go3net.com", department: "People Ops", position: "HR Associate", employmentType: "Intern", status: "Active", hiredAt: "2026-02-02" },
  { id: 10, name: "Ibrahim Musa", code: "G3N-010", email: "ibrahim@go3net.com", department: "Operations", position: "Operations Manager", employmentType: "Full-time", status: "Active", hiredAt: "2021-05-24" },
];

export const dashboardSummary = {
  totalStaff: 128,
  staffDelta: +6,
  departments: 9,
  attendanceToday: { present: 112, late: 9, absent: 7, rate: 0.945 },
  activeProjects: 14,
  pendingLeave: 5,
  pendingApprovals: 11,
  payrollThisMonth: 48_250_000,
  revenueThisMonth: 96_400_000,
  expensesThisMonth: 61_120_000,
};

export const attendanceTrend = [
  { day: "Mon", rate: 93 },
  { day: "Tue", rate: 95 },
  { day: "Wed", rate: 91 },
  { day: "Thu", rate: 96 },
  { day: "Fri", rate: 94 },
  { day: "Sat", rate: 42 },
  { day: "Sun", rate: 8 },
];

export const headcountByDepartment = [
  { department: "Engineering", count: 38 },
  { department: "Sales", count: 24 },
  { department: "Operations", count: 21 },
  { department: "Support", count: 15 },
  { department: "Finance", count: 11 },
  { department: "Design", count: 9 },
  { department: "People Ops", count: 10 },
];

export const pendingApprovals = [
  { id: 1, kind: "Leave", who: "Emeka Nwosu", detail: "Annual leave · Aug 4 – Aug 15", badge: "warning" as const },
  { id: 2, kind: "Expense", who: "Sarah Adeyemi", detail: "Client dinner · ₦86,500", badge: "primary" as const },
  { id: 3, kind: "Leave", who: "Fatima Bello", detail: "Study leave · Aug 11 – Aug 13", badge: "warning" as const },
  { id: 4, kind: "Payroll", who: "Grace Eze", detail: "July run awaiting approval", badge: "danger" as const },
];

export const upcoming = [
  { id: 1, title: "Blessing Umeh's birthday", date: "Aug 2", icon: "🎂" },
  { id: 2, title: "All-hands meeting", date: "Aug 4", icon: "📣" },
  { id: 3, title: "Q3 OKR check-in", date: "Aug 8", icon: "🎯" },
  { id: 4, title: "New hire: QA Engineer starts", date: "Aug 11", icon: "👋" },
];

export const activityFeed = [
  { id: 1, who: "Tunde Bakare", what: "approved Chidi Anyanwu's leave request", when: "12 min ago" },
  { id: 2, who: "Grace Eze", what: "published invoice INV-2026-0147 to Lagos MetroWorks", when: "48 min ago" },
  { id: 3, who: "Adaeze Okafor", what: "moved “Payment gateway v2” to In review", when: "1 h ago" },
  { id: 4, who: "David Ojo", what: "clocked in via QR at Head Office", when: "2 h ago" },
  { id: 5, who: "Sarah Adeyemi", what: "won deal “Kano Agritech onboarding” · ₦12.4m", when: "3 h ago" },
];

export type LeaveRequest = {
  id: number;
  employee: string;
  type: string;
  range: string;
  days: number;
  status: "Pending" | "Approved" | "Rejected";
};

export const leaveRequests: LeaveRequest[] = [
  { id: 1, employee: "Emeka Nwosu", type: "Annual", range: "Aug 4 – Aug 15", days: 10, status: "Pending" },
  { id: 2, employee: "Fatima Bello", type: "Study", range: "Aug 11 – Aug 13", days: 3, status: "Pending" },
  { id: 3, employee: "Chidi Anyanwu", type: "Annual", range: "Jul 21 – Jul 25", days: 5, status: "Approved" },
  { id: 4, employee: "Ibrahim Musa", type: "Compassionate", range: "Jul 14 – Jul 16", days: 3, status: "Approved" },
  { id: 5, employee: "David Ojo", type: "Sick", range: "Jul 8 – Jul 9", days: 2, status: "Rejected" },
];

export const leaveBalances = [
  { type: "Annual", used: 8, total: 20 },
  { type: "Sick", used: 2, total: 10 },
  { type: "Study", used: 0, total: 5 },
  { type: "Compassionate", used: 0, total: 5 },
];

export type AttendanceRow = {
  id: number;
  employee: string;
  clockIn: string;
  clockOut: string | null;
  method: "GPS" | "QR" | "Web";
  office: string;
  status: "On time" | "Late" | "Absent";
};

export const attendanceToday: AttendanceRow[] = [
  { id: 1, employee: "Adaeze Okafor", clockIn: "8:02 AM", clockOut: null, method: "GPS", office: "Head Office", status: "On time" },
  { id: 2, employee: "Tunde Bakare", clockIn: "7:54 AM", clockOut: null, method: "QR", office: "Head Office", status: "On time" },
  { id: 3, employee: "Grace Eze", clockIn: "8:41 AM", clockOut: null, method: "GPS", office: "Head Office", status: "Late" },
  { id: 4, employee: "Sarah Adeyemi", clockIn: "8:10 AM", clockOut: null, method: "GPS", office: "Ikeja Branch", status: "On time" },
  { id: 5, employee: "David Ojo", clockIn: "8:05 AM", clockOut: null, method: "QR", office: "Head Office", status: "On time" },
  { id: 6, employee: "Fatima Bello", clockIn: "9:12 AM", clockOut: null, method: "Web", office: "Remote", status: "Late" },
];
