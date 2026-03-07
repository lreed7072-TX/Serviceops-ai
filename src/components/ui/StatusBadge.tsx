import "./shared-ui.css";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "purple"
  | "gray";

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Work Order statuses
  OPEN: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELED: "gray",
  // Form Response statuses
  DRAFT: "warning",
  SUBMITTED: "info",
  REVIEWED: "success",
  EXPORTED: "purple",
  // Template statuses
  ACTIVE: "success",
  ARCHIVED: "gray",
  // Invoice statuses
  PAID: "success",
  SENT: "info",
  OVERDUE: "error",
  VOID: "gray",
  // Quote statuses
  ACCEPTED: "success",
  REJECTED: "error",
  EXPIRED: "gray",
  // General
  YES: "success",
  NO: "error",
  PENDING: "warning",
};

export function StatusBadge({ children, variant, size = "sm" }: StatusBadgeProps) {
  const text = typeof children === "string" ? children : "";
  const resolvedVariant = variant || STATUS_VARIANT_MAP[text.toUpperCase()] || "default";

  return (
    <span className={`ui-badge ui-badge--${resolvedVariant} ui-badge--${size}`}>
      {children}
    </span>
  );
}

export { STATUS_VARIANT_MAP };
