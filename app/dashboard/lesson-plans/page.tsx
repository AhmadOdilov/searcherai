import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { listLessonPlans } from "@/lib/lesson-plans/service";
import { StatusBadge } from "@/components/lesson-plans/status-badge";
import { LESSON_TYPE_LABELS, formatDate } from "@/lib/lesson-plans/labels";

/**
 * `/dashboard/lesson-plans` — dars ishlanmalari ro'yxati.
 *
 * Server Component: ma'lumot servis qatlamidan TO'G'RIDAN-TO'G'RI olinadi,
 * o'z API'siga HTTP so'rov yuborilmaydi. Bu bitta tarmoq aylanishini
 * tejaydi — server allaqachon bazaga yaqin.
 */
export default async function LessonPlansPage() {
  // Maket (`app/dashboard/layout.tsx`) kirmagan foydalanuvchini /login ga
  // yuborgan, demak bu yerda `user` albatta bor.
  const user = (await getCurrentUser())!;
  const { items } = await listLessonPlans(user.id, { limit: 50 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dars ishlanmalari</h1>
          <p className="mt-1 text-sm text-slate-500">
            {items.length === 0 ? "Hozircha bo'sh." : `Jami ${items.length} ta ishlanma.`}
          </p>
        </div>
        <Link
          href="/dashboard/lesson-plans/new"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Yangi yaratish
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            Birinchi dars ishlanmangizni yarating
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Fan, sinf va mavzuni kiritsangiz, tizim to&apos;liq dars rejasini o&apos;zi
            tuzadi.
          </p>
          <Link
            href="/dashboard/lesson-plans/new"
            className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Boshlash
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
                      {plan.subject} · {plan.grade} ·{" "}
                      {LESSON_TYPE_LABELS[plan.lessonType]} · {plan.durationMinutes}{" "}
                      daqiqa
                    </p>
                  </div>
                  <StatusBadge status={plan.status} />
                </div>

                {plan.status === "FAILED" && plan.errorMessage !== null && (
                  <p className="mt-2 text-xs text-red-600">{plan.errorMessage}</p>
                )}

                <p className="mt-2 text-xs text-slate-400">
                  {formatDate(plan.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
