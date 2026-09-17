import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { Card } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";
import { LandingBackground } from "@/components/landing/background";
import { LandingPreview } from "@/components/landing/preview";
import { LandingSteps } from "@/components/landing/steps";
import { FeatureCard, type FeatureTone } from "@/components/landing/feature-card";
import { HeroButton } from "@/components/landing/hero-button";

/**
 * Bosh sahifa — kirmagan odam uchun tanishtiruv sahifasi.
 *
 * ── Kimga mo'ljallangan ───────────────────────────────────────────────────
 * Havolani birinchi marta ochgan o'qituvchi. U hali hech narsa
 * bilmaydi, shuning uchun sahifa savollarga shu tartibda javob beradi:
 * bu nima → natija qanday ko'rinadi → nima qila oladi → bu MENGA
 * kerakmi → nega aynan shu → qanday ishlaydi. Har bo'limdan keyin yana
 * "Boshlash" tugmasi turadi, chunki qaror qaysi bo'limda yetilishini
 * oldindan bilib bo'lmaydi.
 *
 * ── Nega bu sahifa ichki sahifalardan BOSHQACHA ko'rinadi ─────────────────
 * Ichki sahifalar — ish quroli: jim fon, bir xil kartalar, hech qanday
 * bezak. Bosh sahifaning vazifasi esa boshqa — ishontirish. Shuning
 * uchun bu yerda gradient fon, kattaroq sarlavha, rangli kartalar va
 * tugmadagi porlash bor.
 *
 * MUHIM: bu bezaklarning HAMMASI `components/landing/` ichida, ya'ni
 * faqat shu sahifada. Umumiy `components/ui/` komponentlariga
 * tegilmagan — aks holda dashboard ham "reklama sahifasi" ko'rinishiga
 * o'tib ketardi.
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
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-canvas">
      <LandingBackground />

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
        <section className="pt-6 pb-4 sm:pt-12 sm:text-center">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance text-neutral-900 sm:mx-auto sm:max-w-4xl sm:text-5xl">
            {t("headline.lead")}{" "}
            {/*
              Aynan shu ibora zumrad rangda: sarlavhaning qolgani kim
              uchun ekanini aytadi, bu qism esa NIMA olinishini. Odam
              sarlavhani to'liq o'qimasa ham, ko'zi shu uchta so'zga
              tushadi.
            */}
            <span className="text-primary">{t("headline.accent")}</span>{" "}
            {t("headline.tail")}
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-neutral-600 sm:mx-auto sm:max-w-2xl">
            {t("subheadline")}
          </p>

          {/*
            Ikki tugma ATAYLAB bir xil emas: "Boshlash" — to'ldirilgan va
            porlashli, "Kirish" — ikkinchi darajali. Birinchi marta
            kelgan odamning ko'zi to'g'ri tugmaga tushishi kerak.
          */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <HeroButton href="/register">{t("start")}</HeroButton>
            <HeroButton href="/login" variant="secondary">
              {t("login")}
            </HeroButton>
          </div>

          <p className="mt-4 text-base text-neutral-500">{t("trust")}</p>

          {/* Natija namunasi — "menga qanday narsa beriladi?" savoliga javob. */}
          <LandingPreview />
        </section>

        {/* ── Nima qila oladi ─────────────────────────────────────────── */}
        <section className="pt-12">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-center sm:text-3xl">
            {t("featuresTitle")}
          </h2>

          {/*
            Telefonda bitta ustun: kartada tavsif matni bor va ikki
            ustunda u o'qib bo'lmas darajada torayib ketadi. Dashboard'dagi
            2 ustunli tartib u yerda ishlaydi, chunki u yerda tavsif
            yashiriladi — bu yerda esa aynan tavsif ishontiradi.
          */}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {FEATURES.map((feature) => (
              <li key={feature.key}>
                <FeatureCard
                  icon={feature.icon}
                  tone={feature.tone}
                  title={t(`features.${feature.key}.title`)}
                  description={t(`features.${feature.key}.description`)}
                />
              </li>
            ))}
          </ul>

          <p className="mt-4 text-base text-neutral-500 sm:text-center">
            {t("curriculum")}
          </p>
        </section>

        {/* ── Kimlar uchun ────────────────────────────────────────────── */}
        <section className="pt-14">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-center sm:text-3xl">
            {t("audienceTitle")}
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-neutral-700 sm:mx-auto sm:max-w-3xl sm:text-center">
            {t("audienceIntro")}
          </p>

          {/*
            To'rtta aniq holat. Umumiy "hammaga mos" degan gapdan ko'ra
            aniq vaziyat kuchliroq ishlaydi: odam ro'yxatdan O'ZINI
            topadi va "bu men haqimda" deydi.
          */}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {AUDIENCE.map((item) => (
              <li key={item}>
                <Card padding="sm" className="flex h-full gap-3">
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                  >
                    <Check className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-neutral-900">
                      {t(`audience.${item}.title`)}
                    </p>
                    <p className="mt-1 text-base leading-relaxed text-neutral-600">
                      {t(`audience.${item}.description`)}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Nima uchun aynan Searcher AI ────────────────────────────── */}
        <section className="pt-14">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-center sm:text-3xl">
            {t("whyTitle")}
          </h2>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {WHY.map((item) => (
              <li key={item}>
                <Card padding="sm" className="h-full border-primary-border">
                  <p className="text-lg font-semibold text-primary-ink">
                    {t(`why.${item}.title`)}
                  </p>
                  <p className="mt-2 text-base leading-relaxed text-neutral-600">
                    {t(`why.${item}.description`)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Qanday ishlaydi: uch qadam ──────────────────────────────── */}
        <section className="pt-14">
          <h2 className="text-2xl font-semibold text-neutral-900 sm:text-center sm:text-3xl">
            {t("howTitle")}
          </h2>

          <LandingSteps
            steps={STEPS.map((step) => ({
              key: step,
              title: t(`steps.${step}.title`),
              description: t(`steps.${step}.description`),
            }))}
          />
        </section>

        {/*
          Oxirgi chaqiriq. Sahifani oxirigacha o'qigan odam yuqoriga
          qaytib tugma qidirmasligi kerak.
        */}
        <section className="pt-14 text-center">
          <div className="flex justify-center">
            <HeroButton href="/register">{t("start")}</HeroButton>
          </div>
          {/*
            Jamoa nomi — ishonch uchun. Soxta raqam ("10 000 o'qituvchi")
            yozilmadi: mahsulot yangi va yolg'on birinchi tekshiruvda
            fosh bo'ladi.
          */}
          <p className="mt-6 text-base text-neutral-500">{t("team")}</p>
        </section>

        {/*
          Pastki qator: yordam + "Biz haqimizda".

          Havola AYNAN shu yerda, sahifaning oxirida. Yuqoridagi menyuga
          qo'yilsa, birinchi marta kelgan odamning ko'zi "Boshlash"
          tugmasi bilan raqobatlashardi — "biz kimmiz?" savoli esa
          va'dani O'QIGANDAN keyin paydo bo'ladi.
        */}
        <div className="mt-10 flex flex-col items-center gap-1 border-t border-neutral-200 pt-6 sm:flex-row sm:justify-center sm:gap-6">
          <HelpLink />
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-primary"
          >
            {t("about")}
          </Link>
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
  tone: FeatureTone;
}> = [
  { key: "lessonPlans", icon: BookOpen, tone: "primary" },
  { key: "presentations", icon: Presentation, tone: "accent" },
  { key: "calendarPlans", icon: CalendarDays, tone: "success" },
  { key: "search", icon: Search, tone: "neutral" },
];

/** "Kimlar uchun" bo'limidagi aniq holatlar. */
const AUDIENCE = ["busy", "calendar", "slides", "openLesson"] as const;

/** "Nima uchun aynan Searcher AI" — uchta afzallik. */
const WHY = ["curriculum", "fast", "bilingual"] as const;

/** "Qanday ishlaydi" bosqichlari — tartibi raqamni ham belgilaydi. */
const STEPS = ["input", "generate", "download"] as const;
