import type { Metadata } from "next";
import { TasksClient } from "./tasks-client";

export const metadata: Metadata = { title: "My tasks" };

export default function TasksPage() {
  return <TasksClient />;
}
