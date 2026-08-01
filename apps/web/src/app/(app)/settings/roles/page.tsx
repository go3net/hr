import type { Metadata } from "next";
import { RolesClient } from "./roles-client";

export const metadata: Metadata = { title: "Roles & members" };

export default function RolesPage() {
  return <RolesClient />;
}
