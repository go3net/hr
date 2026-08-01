import type { Metadata } from "next";
import { HelpdeskClient } from "./helpdesk-client";

export const metadata: Metadata = { title: "Help desk" };

export default function HelpdeskPage() {
  return <HelpdeskClient />;
}
