import type { Metadata } from "next";
import { InventoryClient } from "./inventory-client";
import { RequirePermission } from "@/components/auth/require-permission";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <RequirePermission permission="inventory.view">
      <InventoryClient />
    </RequirePermission>
  );
}
