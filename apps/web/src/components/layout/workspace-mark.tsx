"use client";

export function WorkspaceMark({ name, hasLogo }: { name: string; hasLogo: boolean }) {
  if (hasLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tenant logo streams through the authenticated BFF
      <img
        src="/api/backend/settings/branding/logo"
        alt={name}
        className="size-7 shrink-0 rounded-lg object-contain"
      />
    );
  }

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-[13px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
