import type { Metadata } from "next";
import { AssetsClient } from "./assets-client";

export const metadata: Metadata = { title: "Company assets" };

export default function AssetsPage() {
  return <AssetsClient />;
}
