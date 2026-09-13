"use client";

import { useLocale, useTranslations } from "next-intl";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/hooks/use-load-more";
import { formatDate, formatFileSize } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/** Prezentatsiyalar ro'yxati — "Ko'proq ko'rsatish" bilan. */

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
      <ul className="mt-6 space-y-3">
        {items.map((item) => {
          const parts = [
            [item.subject, item.grade].filter(Boolean).join(" · ") || t("standalone"),
          ];
          if (item.slideCount !== null) {
            parts.push(t("slideCount", { count: item.slideCount }));
          }
          if (item.fileSize !== null) {
            parts.push(formatFileSize(item.fileSize, locale));
          }

          return (
            <li key={item.id}>
              <ListRow
                href={`/dashboard/presentations/${item.id}`}
                title={item.title ?? item.topic}
                meta={parts.join(" · ")}
                note={item.lessonPlanId !== null ? t("fromLessonPlan") : null}
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
