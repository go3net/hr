import type { Metadata } from "next";
import { LmsClient } from "./lms-client";

export const metadata: Metadata = { title: "Training" };

export default function LmsPage() {
  return <LmsClient />;
}
