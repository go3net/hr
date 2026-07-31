import type { Metadata } from "next";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <ChatClient />;
}
