import type { Metadata } from "next";
import { PerformanceClient } from "./performance-client";

export const metadata: Metadata = { title: "Performance" };

export default function PerformancePage() {
  return <PerformanceClient />;
}
