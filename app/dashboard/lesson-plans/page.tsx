import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listLessonPlans } from "@/lib/lesson-plans/service";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/ui/labels";
import { translateStoredError } from "@/lib/i18n/stored-error";
import type { UiLocale } from "@/lib/i18n/config";

/** `/dashboard/lesson-plans` — dars ishlanmalari ro'yxati. */
export default async function LessonPlansPage() {
  const user = (await getCurrentUser())!;
  const { items } = await listLessonPlans(user.id, { limit: 50 });

  const t = await getTranslations("lessonPlans");
  const tRoot = await getTranslations();
  const locale = (await getLocale()) as UiLocale;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {items.length === 0 ? t("empty") : t("count", { count: items.length })}
          </p>
        </div>
        <Link
          href="/dashboard/lesson-plans/new"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {tRoot("common.create")}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">{t("emptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {t("emptyDescription")}
          </p>
          <Link
            href="/dashboard/lesson-plans/new"
            className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {tRoot("common.start")}
          </Link>
        </div>
      ) : (
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
      )}
    </div>
  );
}
