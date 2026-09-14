import { getTranslations } from "next-intl/server";

/**
 * Natija namunasi — kichik "slayd" va uning orqasidagi "hujjat".
 *
 * ── Nega skrinshot emas ───────────────────────────────────────────────────
 * Haqiqiy skrinshot ikki muammo keltiradi: u ikki tilda ham, qorong'i
 * rejimda ham eskiradi (interfeys o'zgarishi bilan rasm yolg'on
 * gapira boshlaydi) va telefonda o'qilmaydigan darajada kichrayadi.
 *
 * Bu yerdagi namuna esa oddiy HTML: matni tarjima qilinadi, ranglari
 * tokenlardan keladi (ya'ni qorong'i rejimda o'zi moslashadi) va
 * bironta ham qo'shimcha bayt yuklanmaydi.
 *
 * Vazifasi — aniqlik emas, TANIQLIK: odam "menga qanday narsa
 * beriladi?" degan savolga bir qarashda javob olsin.
 */
export async function LandingPreview() {
  const t = await getTranslations("landing.preview");

  return (
    <div aria-hidden className="relative mx-auto mt-12 max-w-2xl px-2 sm:px-8">
      {/*
        Hujjat — slayd ORQASIDA, chapda va biroz qiyshiq. Telefonda
        yashiriladi: 390px kenglikda u slaydni bosib qolardi.
      */}
      <div className="absolute -top-6 -left-6 hidden w-44 -rotate-6 rounded-lg border border-neutral-200 bg-surface p-4 shadow-card sm:block">
        <p className="text-sm font-semibold text-neutral-900">{t("docTitle")}</p>
        <p className="mt-1 text-xs text-neutral-500">{t("docMeta")}</p>
        <div className="mt-3 space-y-1.5">
          <span className="block h-1.5 w-full rounded-full bg-neutral-200" />
          <span className="block h-1.5 w-11/12 rounded-full bg-neutral-200" />
          <span className="block h-1.5 w-9/12 rounded-full bg-neutral-200" />
          <span className="block h-1.5 w-full rounded-full bg-neutral-200" />
          <span className="block h-1.5 w-7/12 rounded-full bg-neutral-200" />
        </div>
      </div>

      {/* Slayd — oldinda, "klassik" shablon ko'rinishida. */}
      <div className="relative rounded-xl border border-neutral-200 bg-surface p-3 shadow-card-hover sm:ml-28 sm:p-4">
        <div className="flex aspect-video flex-col rounded-lg bg-surface p-4 sm:p-6">
          <p className="text-lg font-semibold text-primary sm:text-2xl">
            {t("slideTitle")}
          </p>
          <span className="mt-2 block h-px w-full bg-neutral-200" />

          <div className="mt-3 flex-1 space-y-2 sm:mt-4 sm:space-y-3">
            <p className="flex gap-2 text-sm leading-relaxed text-neutral-700 sm:text-base">
              <span className="text-primary">•</span>
              {t("slideBullet")}
            </p>
            <p className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span className="block h-2 w-10/12 rounded-full bg-neutral-200" />
            </p>
            <p className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span className="block h-2 w-8/12 rounded-full bg-neutral-200" />
            </p>
          </div>

          <p className="text-right text-xs text-neutral-400">{t("slideFooter")}</p>
        </div>
      </div>
    </div>
  );
}
