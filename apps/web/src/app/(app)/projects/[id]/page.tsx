import type { Metadata } from "next";
import { BoardClient } from "./board-client";

export const metadata: Metadata = { title: "Project board" };

export default async function ProjectBoardPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <BoardClient projectId={Number(id)} />;
}
