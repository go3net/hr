import type { Metadata } from "next";
import { PayrollClient } from "./payroll-client";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollPage() {
  return <PayrollClient />;
}
