"use client";

import { RecordActions } from "@/components/ui/record-actions";

/**
 * Dars ishlanmasi ustidagi amallar.
 *
 * Butun mantiq `RecordActions` da — bu yerda faqat modulga xos manzillar.
 */
export function PlanActions({
  planId,
  status,
}: {
  planId: string;
  status: "PENDING" | "READY" | "FAILED";
}) {
  return (
    <RecordActions
      resource="/api/lesson-plans"
      recordId={planId}
      listHref="/dashboard/lesson-plans"
      status={status}
    />
  );
}
