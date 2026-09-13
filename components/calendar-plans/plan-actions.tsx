"use client";

import { RecordActions } from "@/components/ui/record-actions";

/**
 * Kalendar reja ustidagi amallar.
 *
 * Kutish ogohlantirishi shu modulning O'Z matnidan olinadi: bu modul eng
 * sekin (60-90 soniya), umumiy "30 soniyagacha" jumlasi bu yerda
 * noto'g'ri bo'lardi.
 */
export function CalendarPlanActions({
  planId,
  status,
}: {
  planId: string;
  status: "PENDING" | "READY" | "FAILED";
}) {
  return (
    <RecordActions
      resource="/api/calendar-plans"
      recordId={planId}
      listHref="/dashboard/calendar-plans"
      status={status}
      waitNamespace="calendarPlans.detail"
    />
  );
}
