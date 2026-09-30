import type { Metadata } from "next";
import { EmployeeProfile } from "./profile-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Staff profile" };

export default async function EmployeeProfilePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  return (
    <RequirePermission permission="hr.employees.view">
      <EmployeeProfile id={id} />
    </RequirePermission>
  );
}
