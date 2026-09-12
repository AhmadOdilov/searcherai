"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/hooks/use-load-more";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/** Kalendar rejalar ro'yxati — "Ko'proq yuklash" bilan. */

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
      <ul className="mt-6 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/dashboard/calendar-plans/${item.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.title ?? `${item.subject} — ${item.period}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.subject} · {item.grade} ·{" "}
                    {t("meta", { weeks: item.weeks, hours: item.hoursPerWeek })}
                    {item.rowCount !== null &&
                      ` · ${t("rowCount", { count: item.rowCount })}`}
                    {item.fileSize !== null &&
                      ` · ${formatFileSize(item.fileSize, locale)}`}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              {item.status === "FAILED" && item.errorMessage !== null && (
                <p className="mt-2 text-xs text-red-600">
                  {translateStoredError(tRoot, item.errorMessage)}
                </p>
              )}

              <p className="mt-2 text-xs text-slate-400">
                {formatDate(item.createdAt, locale)}
              </p>
            </Link>
          </li>
        ))}
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
