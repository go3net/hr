import type { Metadata } from "next";
import { CrmClient } from "./crm-client";

export const metadata: Metadata = { title: "CRM" };

export default function CrmPage() {
  return <CrmClient />;
}
