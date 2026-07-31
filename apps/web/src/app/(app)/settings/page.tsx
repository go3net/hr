import type { Metadata } from "next";
import { SecurityClient } from "./security-client";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SecurityClient />;
}
