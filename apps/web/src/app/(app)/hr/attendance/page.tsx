import type { Metadata } from "next";
import { AttendanceClient } from "./attendance-client";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  return <AttendanceClient />;
}
