"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";

/**
 * Lazy singleton for the Reverb WebSocket connection. Returns null on the
 * server and when no key is configured, so every caller degrades to the
 * polling fallback cleanly.
 */

declare global {
  interface Window {
    Pusher?: typeof Pusher;
  }
}

let instance: Echo<"reverb"> | null = null;

export function getEcho(): Echo<"reverb"> | null {
  if (typeof window === "undefined") return null;

  const key = process.env.NEXT_PUBLIC_REVERB_KEY;
  if (!key) return null;

  if (!instance) {
    window.Pusher = Pusher;
    const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http";
    instance = new Echo({
      broadcaster: "reverb",
      key,
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? window.location.hostname,
      wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
      wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 443),
      forceTLS: scheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: "/api/broadcasting/auth",
    });
  }

  return instance;
}
