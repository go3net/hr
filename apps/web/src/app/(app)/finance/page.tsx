import type { Metadata } from "next";
import { FinanceClient } from "./finance-client";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return <FinanceClient />;
}
