import type { Metadata } from "next";
import { DepartmentsClient } from "./departments-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Departments" };

export default function DepartmentsPage() {
  return (
    <RequirePermission permission="hr.departments.view">
      <DepartmentsClient />
    </RequirePermission>
  );
}
