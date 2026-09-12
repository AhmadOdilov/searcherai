"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/hooks/use-load-more";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/** Prezentatsiyalar ro'yxati — "Ko'proq yuklash" bilan. */

export interface PresentationListItem {
  id: string;
  lessonPlanId: string | null;
  topic: string;
  subject: string | null;
  grade: string | null;
  title: string | null;
  status: "PENDING" | "READY" | "FAILED";
  errorMessage: string | null;
  slideCount: number | null;
  fileSize: number | null;
  createdAt: string | Date;
}

export function PresentationList({
  initialItems,
  initialCursor,
}: {
  initialItems: PresentationListItem[];
  initialCursor: string | null;
}) {
  const t = useTranslations("presentations");
  const tRoot = useTranslations();
  const locale = useLocale() as UiLocale;

  const { items, hasMore, loading, error, loadMore } = useLoadMore<PresentationListItem>({
    resource: "/api/presentations",
    initialItems,
    initialCursor,
  });

  return (
    <>
      <ul className="mt-6 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/dashboard/presentations/${item.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.title ?? item.topic}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[item.subject, item.grade].filter(Boolean).join(" · ") ||
                      t("standalone")}
                    {item.slideCount !== null &&
                      ` · ${t("slideCount", { count: item.slideCount })}`}
                    {item.fileSize !== null &&
                      ` · ${formatFileSize(item.fileSize, locale)}`}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              {item.lessonPlanId !== null && (
                <p className="mt-2 text-xs text-slate-400">{t("fromLessonPlan")}</p>
              )}

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
