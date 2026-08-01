import * as React from "react";
import { cn, initials } from "@/lib/utils";

const palette = [
  "bg-primary/15 text-primary",
  "bg-chart-2/15 text-chart-2",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
];

export function Avatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const hue = palette[name.length % palette.length];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium",
        hue,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
