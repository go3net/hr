import type { Metadata } from "next";
import { EmployeesClient } from "./employees-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return (
    <RequirePermission permission="hr.employees.view">
      <EmployeesClient />
    </RequirePermission>
  );
}
