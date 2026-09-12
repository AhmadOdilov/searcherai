"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/lib/hooks/use-load-more";
import { formatDate } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/**
 * Dars ishlanmalari ro'yxati — klient komponenti.
 *
 * ── Nega klient ───────────────────────────────────────────────────────────
 * "Ko'proq yuklash" tugmasi holatni (yuklangan yozuvlar, kursor) saqlashi
 * kerak. Birinchi sahifa SERVERDA render qilinadi va shu yerga `props`
 * orqali keladi — ya'ni birinchi ko'rinish uchun qo'shimcha HTTP so'rov
 * YO'Q, faqat davomi olinadi.
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
      <ul className="mt-6 space-y-2">
        {items.map((plan) => (
          <li key={plan.id}>
            <Link
              href={`/dashboard/lesson-plans/${plan.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {plan.topic}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {plan.subject} · {plan.grade} · {t(`types.${plan.lessonType}`)} ·{" "}
                    {t("fields.durationOption", { minutes: plan.durationMinutes })}
                  </p>
                </div>
                <StatusBadge status={plan.status} />
              </div>

              {plan.status === "FAILED" && plan.errorMessage !== null && (
                <p className="mt-2 text-xs text-red-600">
                  {translateStoredError(tRoot, plan.errorMessage)}
                </p>
              )}

              <p className="mt-2 text-xs text-slate-400">
                {formatDate(plan.createdAt, locale)}
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
