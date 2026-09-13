"use client";

import { useLocale, useTranslations } from "next-intl";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/hooks/use-load-more";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/** Kalendar rejalar ro'yxati — "Ko'proq ko'rsatish" bilan. */

export interface CalendarPlanListItem {
  id: string;
  subject: string;
  grade: string;
  period: string;
  weeks: number;
  hoursPerWeek: number;
  title: string | null;
  status: "PENDING" | "READY" | "FAILED";
  errorMessage: string | null;
  rowCount: number | null;
  fileSize: number | null;
  createdAt: string | Date;
}

export function CalendarPlanList({
  initialItems,
  initialCursor,
}: {
  initialItems: CalendarPlanListItem[];
  initialCursor: string | null;
}) {
  const t = useTranslations("calendarPlans");
  const tRoot = useTranslations();
  const locale = useLocale() as UiLocale;

  const { items, hasMore, loading, error, loadMore } = useLoadMore<CalendarPlanListItem>({
    resource: "/api/calendar-plans",
    initialItems,
    initialCursor,
  });

  return (
    <>
      <ul className="mt-6 space-y-3">
        {items.map((item) => {
          const parts = [
            item.subject,
            item.grade,
            t("meta", { weeks: item.weeks, hours: item.hoursPerWeek }),
          ];
          if (item.rowCount !== null) {
            parts.push(t("rowCount", { count: item.rowCount }));
          }
          if (item.fileSize !== null) {
            parts.push(formatFileSize(item.fileSize, locale));
          }

          return (
            <li key={item.id}>
              <ListRow
                href={`/dashboard/calendar-plans/${item.id}`}
                title={item.title ?? `${item.subject} — ${item.period}`}
                meta={parts.join(" · ")}
                status={item.status}
                errorText={
                  item.status === "FAILED" && item.errorMessage !== null
                    ? translateStoredError(tRoot, item.errorMessage)
                    : null
                }
                date={formatDate(item.createdAt, locale)}
              />
            </li>
          );
        })}
      </ul>

      <LoadMoreButton
        hasMore={hasMore}
        loading={loading}
        error={error}
        onClick={loadMore}
      />
    </>
  );
}
