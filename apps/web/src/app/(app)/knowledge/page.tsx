import type { Metadata } from "next";
import { KnowledgeClient } from "./knowledge-client";

export const metadata: Metadata = { title: "Knowledge base" };

export default function KnowledgePage() {
  return <KnowledgeClient />;
}
