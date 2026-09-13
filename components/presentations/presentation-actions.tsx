"use client";

import { RecordActions } from "@/components/ui/record-actions";

/** Prezentatsiya ustidagi amallar — mantiq `RecordActions` da. */
export function PresentationActions({
  presentationId,
  status,
}: {
  presentationId: string;
  status: "PENDING" | "READY" | "FAILED";
}) {
  return (
    <RecordActions
      resource="/api/presentations"
      recordId={presentationId}
      listHref="/dashboard/presentations"
      status={status}
    />
  );
}
