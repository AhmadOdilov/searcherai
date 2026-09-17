import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  BookMarked,
  FileDown,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, ToneCard } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

/**
 * "Biz haqimizda" — ma'lumot sahifasi.
 *
 * ── Kimga mo'ljallangan ───────────────────────────────────────────────────
 * Mahsulotni ko'rgan, lekin hali ishonmagan odam. U bosh sahifadagi
 * va'dani o'qidi va endi boshqa savol beryapti: "bu kim tomonidan
 * qilingan, ichkarida nima bo'ladi va nega bepul?". Shuning uchun bu
 * yerda yangi va'da YO'Q — faqat javob.
 *
 * ── Nega bosh sahifadan SOKINROQ ko'rinadi ────────────────────────────────
 * Bosh sahifaning vazifasi — ishontirish, shuning uchun u yerda
 * gradient fon, rangli kartalar va porlagan tugma bor. Bu sahifaning
 * vazifasi — tushuntirish. Bezak bu yerda matnni sekinlashtiradi,
 * shuning uchun `components/landing/` dagi hech narsa ishlatilmadi:
 * oddiy `Card`, bitta ustun va o'qish uchun qulay kenglik.
 *
 * ── Nega matn kengligi `max-w-3xl` ────────────────────────────────────────
 * Bosh sahifada `max-w-5xl`, chunki u yerda kartalar yonma-yon turadi.
 * Bu yerda esa uzun paragraflar: keng ustunda ko'z qatorning boshiga
 * qaytolmay qoladi va o'qish charchatadi.
 *
 * ── Nega `proxy.ts` ga tegilmadi ──────────────────────────────────────────
 * `/about` proxy matcher'iga kirmaydi, ya'ni sahifa HAMMAGA ochiq:
 * kirmagan mehmonga ham, kirgan o'qituvchiga ham. Bu ataylab —
 * "biz kimmiz?" savoli ro'yxatdan o'tgandan keyin ham paydo bo'ladi,
 * va u paytda odamni `/dashboard` ga qaytarib yuborish g'alati bo'lardi.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
        {/*
          Logotip — havola. Bu sahifaga odam bosh sahifadan keladi va
          qaytish yo'li ko'rinib turishi kerak. Pastda yana bir marta
          takrorlanadi: uzun matnni oxirigacha o'qigan odam yuqoriga
          qaytib qidirmasin.
        */}
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <GraduationCap className="size-6" />
          </span>
          <span className="text-lg font-semibold text-neutral-900">Searcher AI</span>
        </Link>
        <LocaleSwitcher />
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-16">
        <Link
          href="/"
          className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowLeft aria-hidden className="size-5 shrink-0" />
          {t("backHome")}
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-neutral-900 sm:text-4xl">
          {t("title")}
        </h1>

        {/*
          Yetakchi paragraf — butun sahifaning javobini bitta jumlada
          beradi. Sahifani tashlab ketgan odam ham shu qismni o'qib
          ulguradi.
        */}
        <p className="mt-4 text-lg leading-relaxed text-neutral-700">{t("lead")}</p>

        {/* ── Loyiha haqida ───────────────────────────────────────────── */}
        <section className="pt-10">
          <h2 className="text-2xl font-semibold text-neutral-900">{t("story.title")}</h2>

          {/*
            Uch paragraf, shu tartibda: MUAMMO (vaqt qayerga ketadi) →
            YECHIM (biz nima qilamiz) → CHEGARA (nima qilmaymiz).
            Uchinchisi eng muhimi: "AI o'qituvchining o'rnini bosadi"
            degan qo'rquv aytilmasa ham bor, va unga javob berilmasa
            sahifa ishonchni oshirmaydi.
          */}
          <div className="mt-4 space-y-4 text-base leading-relaxed text-neutral-700">
            <p>{t("story.p1")}</p>
            <p>{t("story.p2")}</p>
            <p>{t("story.p3")}</p>
          </div>
        </section>

        {/* ── Jamoa ───────────────────────────────────────────────────── */}
        <section className="pt-10">
          <h2 className="text-2xl font-semibold text-neutral-900">{t("team.title")}</h2>

          <Card className="mt-4 flex gap-4">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
            >
              <Users className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-900">{t("team.name")}</p>
              <p className="text-base text-neutral-500">{t("team.location")}</p>
              <p className="mt-2 text-base leading-relaxed text-neutral-700">
                {t("team.description")}
              </p>
            </div>
          </Card>
        </section>

        {/* ── Qanday ishlaydi ─────────────────────────────────────────── */}
        <section className="pt-10">
          <h2 className="text-2xl font-semibold text-neutral-900">{t("how.title")}</h2>
          <p className="mt-2 text-base text-neutral-600">{t("how.intro")}</p>

          {/*
            To'rtta karta bitta ustunda. Bosh sahifadagi 2 ustunli tartib
            bu yerda ishlamaydi: u yerda karta matni bir-ikki qator, bu
            yerda esa to'liq tushuntirish — ikki ustunda u ingichka
            bo'lib ketardi.

            Ranglar ham yo'q (bosh sahifadagi `FeatureCard` dan farqi):
            bu to'rttasi tanlov emas, bir narsaning to'rt tomoni.
          */}
          <ul className="mt-4 space-y-3">
            {HOW_ITEMS.map((item) => (
              <li key={item.key}>
                <Card padding="sm" className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700"
                  >
                    <item.icon className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {t(`how.${item.key}.title`)}
                    </h3>
                    <p className="mt-1 text-base leading-relaxed text-neutral-700">
                      {t(`how.${item.key}.description`)}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Narxi ───────────────────────────────────────────────────── */}
        <section className="pt-10">
          <h2 className="text-2xl font-semibold text-neutral-900">{t("price.title")}</h2>

          {/*
            Yagona rangli blok — ataylab shu yerda. "Bepulmi?" savoli
            sahifadagi eng ko'p qidiriladigan javob, va rangli fon uni
            skanerlab o'qiydigan odamga ko'rsatadi.

            Cheklov ham SHU YERDA, kichikroq matnda: "bepul" so'zi
            yolg'iz qolsa, birinchi cheklovga urilgan odam aldanganday
            his qiladi.
          */}
          <ToneCard tone="primary" className="mt-4">
            <p className="text-base leading-relaxed text-primary-ink">
              {t("price.description")}
            </p>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              {t("price.note")}
            </p>
          </ToneCard>
        </section>

        {/* ── Bog'lanish ──────────────────────────────────────────────── */}
        <section className="pt-10">
          <h2 className="text-2xl font-semibold text-neutral-900">
            {t("contact.title")}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-neutral-700">
            {t("contact.description")}
          </p>

          {/*
            `HelpLink` — ilovaning hamma joyidagi O'SHA havola. Bu yerga
            alohida Telegram tugmasi yasalmadi: manzil bitta joyda
            (`lib/ui/support.ts`) tursin, aks holda jamoa kontaktni
            almashtirganda bu sahifa eskirib qolardi.
          */}
          <div className="mt-3 -ml-3">
            <HelpLink />
          </div>
        </section>

        <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-primary"
          >
            <ArrowLeft aria-hidden className="size-5 shrink-0" />
            {t("backHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * "Qanday ishlaydi" bandlari.
 *
 * Tartib tasodifiy emas — foydalanuvchining yo'li bo'yicha: material
 * QANDAY yaratiladi → NIMAGA tayanadi → NIMA bo'lib qaytadi → keyin
 * ma'lumotlarga NIMA bo'ladi.
 */
const HOW_ITEMS: Array<{
  key: "ai" | "curriculum" | "files" | "privacy";
  icon: LucideIcon;
}> = [
  { key: "ai", icon: Sparkles },
  { key: "curriculum", icon: BookMarked },
  { key: "files", icon: FileDown },
  { key: "privacy", icon: ShieldCheck },
];
