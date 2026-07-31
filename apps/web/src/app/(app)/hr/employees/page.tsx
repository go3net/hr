import type { Metadata } from "next";
import { EmployeesClient } from "./employees-client";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return <EmployeesClient />;
}
