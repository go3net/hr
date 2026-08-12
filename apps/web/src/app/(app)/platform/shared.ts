export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" | "primary" }
> = {
  active: { label: "Active", variant: "success" },
  trial: { label: "Trial", variant: "warning" },
  past_due: { label: "Past due", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};
