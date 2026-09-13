import { getTranslations } from "next-intl/server";
import { GraduationCap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { LinkButton } from "@/components/ui/button";
import { HelpLink } from "@/components/ui/help-link";

/**
 * Bosh sahifa.
 *
 * Kirgan foydalanuvchiga — ish sahifasiga o'tish. Kirmaganiga — ikki
 * yo'l: "hisob yaratish" (asosiy, to'ldirilgan tugma) va "kirish"
 * (ikkinchi darajali). Ikkitasi bir xil ko'rinishda bo'lsa, birinchi
 * marta kelgan odam qaysi biri o'ziga tegishli ekanini o'ylab qoladi.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      {/* Til almashtirgich kirmagan foydalanuvchiga ham kerak. */}
      <div className="flex justify-end px-4 py-4">
        <LocaleSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <div
            aria-hidden
            className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-primary-soft text-primary"
          >
            <GraduationCap className="size-9" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            {t("app.name")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            {t("home.description")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {user ? (
              <LinkButton href="/dashboard" size="lg" fullWidth>
                {t("home.openDashboard")}
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/register" size="lg" fullWidth>
                  {t("home.register")}
                </LinkButton>
                <LinkButton href="/login" size="lg" variant="secondary" fullWidth>
                  {t("home.login")}
                </LinkButton>
              </>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <HelpLink />
          </div>
        </div>
      </div>
    </main>
  );
}
