import { STATUS_LABELS, STATUS_STYLES } from "@/lib/ui/labels";

/** Generatsiya holati — rangli nishon. */
export function StatusBadge({ status }: { status: "PENDING" | "READY" | "FAILED" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
