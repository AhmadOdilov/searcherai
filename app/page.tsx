import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";

/**
 * Bosh sahifa — kirmagan odam uchun tanishtiruv sahifasi.
 *
 * ── Kimga mo'ljallangan ───────────────────────────────────────────────────
 * Havolani birinchi marta ochgan o'qituvchi. U hali hech narsa
 * bilmaydi, shuning uchun sahifa uchta savolga shu tartibda javob
 * beradi: bu nima → nima qila oladi → qanday ishlaydi. Har bo'limdan
 * keyin yana "Boshlash" tugmasi turadi, chunki qaror qaysi bo'limda
 * yetilishini oldindan bilib bo'lmaydi.
 *
 * ── Nega bu yerda `getCurrentUser()` YO'Q ─────────────────────────────────
 * Kirgan foydalanuvchini `/dashboard` ga `proxy.ts` yo'naltiradi
 * (`/login` va `/register` bilan bir xil qoida). Shu sababli sahifa
 * BAZAGA murojaat qilmaydi: tanishtiruv sahifasi ilovaga hali kirmagan
 * odamga ko'rsatiladi va uning har ochilishi uchun sessiya so'rovi
 * yuborish keraksiz yuk.
 */
export default async function HomePage() {
  const t = await getTranslations("landing");

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <GraduationCap className="size-6" />
          </span>
          <span className="text-lg font-semibold text-neutral-900">Searcher AI</span>
        </div>
        <LocaleSwitcher />
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pb-16">
        {/*
          ── Sarlavha bloki ──────────────────────────────────────────────
          Telefonda matn chapga tekislangan (uzun sarlavhani markazdan
          o'qish qiyin), kattaroq ekranda markazga keladi.
        */}
        <section className="py-8 sm:py-14 sm:text-center">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 sm:mx-auto sm:max-w-3xl sm:text-4xl">
            {t("headline")}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600 sm:mx-auto sm:max-w-2xl">
            {t("subheadline")}
          </p>

          {/*
            Ikki tugma ATAYLAB bir xil emas: "Boshlash" — to'ldirilgan,
            "Kirish" — ikkinchi darajali. Birinchi marta kelgan odamning
            ko'zi to'g'ri tugmaga tushishi kerak.
          */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <LinkButton
              href="/register"
              size="lg"
              fullWidth
              className="sm:w-auto sm:px-10"
            >
              {t("start")}
            </LinkButton>
            <LinkButton
              href="/login"
              size="lg"
              variant="secondary"
              fullWidth
              className="sm:w-auto sm:px-10"
            >
              {t("login")}
            </LinkButton>
          </div>

          <p className="mt-4 text-base text-neutral-500">{t("trust")}</p>
        </section>

        {/* ── Nima qila oladi ─────────────────────────────────────────── */}
        <section className="pt-4">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-center">
            {t("featuresTitle")}
          </h2>

          {/*
            Telefonda bitta ustun: kartada tavsif matni bor va ikki
            ustunda u o'qib bo'lmas darajada torayib ketadi. Dashboard'dagi
            2 ustunli tartib u yerda ishlaydi, chunki u yerda tavsif
            yashiriladi — bu yerda esa aynan tavsif ishontiradi.
          */}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.key}>
                  <Card padding="sm" className="flex h-full gap-4">
                    <span
                      aria-hidden
                      className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
                    >
                      <Icon className="size-7" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-neutral-900">
                        {t(`features.${feature.key}.title`)}
                      </h3>
                      <p className="mt-1 text-base leading-relaxed text-neutral-600">
                        {t(`features.${feature.key}.description`)}
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-base text-neutral-500 sm:text-center">
            {t("curriculum")}
          </p>
        </section>

        {/* ── Qanday ishlaydi: uch qadam ──────────────────────────────── */}
        <section className="pt-12">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-center">
            {t("howTitle")}
          </h2>

          {/*
            Raqamlar — forma ichidagi bosqichlar bilan BIR XIL ko'rinishda
            (doira + primary rang). Ro'yxatdan o'tgan odam ilova ichida
            xuddi shu belgini ko'radi va sahifa unga tanish tuyuladi.
          */}
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step}>
                <Card padding="sm" className="h-full">
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-neutral-900">
                    {t(`steps.${step}.title`)}
                  </h3>
                  <p className="mt-1 text-base leading-relaxed text-neutral-600">
                    {t(`steps.${step}.description`)}
                  </p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/*
          Oxirgi chaqiriq. Sahifani oxirigacha o'qigan odam yuqoriga
          qaytib tugma qidirmasligi kerak.
        */}
        <section className="pt-12 text-center">
          <LinkButton href="/register" size="lg" fullWidth className="sm:w-auto sm:px-12">
            {t("start")}
          </LinkButton>
        </section>

        <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
          <HelpLink />
        </div>
      </div>
    </main>
  );
}

/**
 * To'rtta asosiy funksiya.
 *
 * Tartib dashboard'dagi bilan bir xil: eng ko'p ishlatiladigani
 * birinchi. "Rasmdan material" va "Tarjima" bu yerda ATAYLAB yo'q —
 * bosh sahifada oltita karta ko'rsatish tanlovni qiyinlashtiradi,
 * to'rttasi esa bir ekranga sig'adi.
 */
const FEATURES: Array<{
  key: "lessonPlans" | "presentations" | "calendarPlans" | "search";
  icon: LucideIcon;
}> = [
  { key: "lessonPlans", icon: BookOpen },
  { key: "presentations", icon: Presentation },
  { key: "calendarPlans", icon: CalendarDays },
  { key: "search", icon: Search },
];

/** "Qanday ishlaydi" bosqichlari — tartibi raqamni ham belgilaydi. */
const STEPS = ["input", "generate", "download"] as const;
