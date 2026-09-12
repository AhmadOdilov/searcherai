import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

/**
 * Bosh sahifa. Kirgan foydalanuvchiga /dashboard havolasi, boshqalarga
 * kirish/ro'yxatdan o'tish taklifi.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      {/* Til almashtirgich kirmagan foydalanuvchiga ham kerak. */}
      <div className="flex justify-end px-4 py-4">
        <LocaleSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-semibold text-slate-900">{t("app.name")}</h1>
          <p className="mt-3 text-sm text-slate-600">{t("home.description")}</p>

          <div className="mt-8 flex items-center justify-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {t("home.openDashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  {t("home.register")}
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  {t("home.login")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
