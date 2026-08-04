import type { Metadata } from "next";
import { SecurityClient } from "./security-client";
import { SettingsSections } from "./settings-sections";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <SecurityClient />
      <SettingsSections />
    </div>
  );
}
