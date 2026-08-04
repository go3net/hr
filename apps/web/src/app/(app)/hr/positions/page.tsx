import type { Metadata } from "next";
import { PositionsClient } from "./positions-client";

export const metadata: Metadata = { title: "Positions" };

export default function PositionsPage() {
  return <PositionsClient />;
}
