import type { Metadata } from "next";
import { LeaveClient } from "./leave-client";

export const metadata: Metadata = { title: "Leave" };

export default function LeavePage() {
  return <LeaveClient />;
}
