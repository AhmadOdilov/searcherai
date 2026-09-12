import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { UserGreeting } from "@/components/user-greeting";

/**
 * `/dashboard` — kirgan foydalanuvchining ishchi sahifasi.
 *
 * Avtorizatsiya va umumiy sarlavha `app/dashboard/layout.tsx` da.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Klient komponenti — foydalanuvchini contextdan oladi. */}
      <UserGreeting />

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {MODULES.map((module) =>
          module.href === null ? (
            <li
              key={module.key}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-slate-900">
                {t(`modules.${module.key}.title`)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t(`modules.${module.key}.description`)}
              </p>
              <p className="mt-3 text-xs font-medium text-slate-400">{t("comingSoon")}</p>
            </li>
          ) : (
            <li key={module.key}>
              <Link
                href={module.href}
                className="block h-full rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <p className="text-sm font-medium text-slate-900">
                  {t(`modules.${module.key}.title`)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t(`modules.${module.key}.description`)}
                </p>
                <p className="mt-3 text-xs font-medium text-slate-900">{t("open")}</p>
              </Link>
            </li>
          ),
        )}
      </ul>

      <p className="mt-8 text-xs text-slate-400">
        {t("systemStatus")}{" "}
        <Link href="/api/health" className="underline">
          /api/health
        </Link>
      </p>
    </div>
  );
}

/** `href: null` — modul hali yozilmagan. Matnlar tarjima kalitlaridan. */
const MODULES: Array<{
  key: "lessonPlans" | "presentations" | "calendarPlans" | "translation";
  href:
    | "/dashboard/lesson-plans"
    | "/dashboard/presentations"
    | "/dashboard/calendar-plans"
    | null;
}> = [
  { key: "lessonPlans", href: "/dashboard/lesson-plans" },
  { key: "presentations", href: "/dashboard/presentations" },
  { key: "calendarPlans", href: "/dashboard/calendar-plans" },
  { key: "translation", href: null },
];
