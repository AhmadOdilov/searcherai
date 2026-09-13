"use client";

import { useLocale, useTranslations } from "next-intl";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/hooks/use-load-more";
import { formatDate } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/**
 * Dars ishlanmalari ro'yxati — klient komponenti.
 *
 * ── Nega klient ───────────────────────────────────────────────────────────
 * "Ko'proq ko'rsatish" tugmasi holatni (yuklangan yozuvlar, kursor)
 * saqlashi kerak. Birinchi sahifa SERVERDA render qilinadi va shu yerga
 * `props` orqali keladi — ya'ni birinchi ko'rinish uchun qo'shimcha
 * so'rov YO'Q, faqat davomi olinadi.
 */

export interface LessonPlanListItem {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  durationMinutes: number;
  lessonType: "NEW_TOPIC" | "REINFORCEMENT" | "ASSESSMENT";
  status: "PENDING" | "READY" | "FAILED";
  errorMessage: string | null;
  createdAt: string | Date;
}

export function LessonPlanList({
  initialItems,
  initialCursor,
}: {
  initialItems: LessonPlanListItem[];
  initialCursor: string | null;
}) {
  const t = useTranslations("lessonPlans");
  const tRoot = useTranslations();
  const locale = useLocale() as UiLocale;

  const { items, hasMore, loading, error, loadMore } = useLoadMore<LessonPlanListItem>({
    resource: "/api/lesson-plans",
    initialItems,
    initialCursor,
  });

  return (
    <>
      <ul className="mt-6 space-y-3">
        {items.map((plan) => (
          <li key={plan.id}>
            <ListRow
              href={`/dashboard/lesson-plans/${plan.id}`}
              title={plan.topic}
              meta={`${plan.subject} · ${plan.grade} · ${t(`types.${plan.lessonType}`)} · ${t(
                "fields.durationOption",
                { minutes: plan.durationMinutes },
              )}`}
              status={plan.status}
              errorText={
                plan.status === "FAILED" && plan.errorMessage !== null
                  ? translateStoredError(tRoot, plan.errorMessage)
                  : null
              }
              date={formatDate(plan.createdAt, locale)}
            />
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
