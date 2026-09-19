"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { useGenerationPolling } from "@/lib/hooks/use-generation-polling";
import { ToneCard } from "@/components/ui/card";

/**
 * Fon rejimidagi generatsiyani kuzatib, tugagach sahifani yangilaydi.
 *
 * ── Nega natija sahifasida, formada emas ──────────────────────────────────
 * Forma POST yuborgach DARHOL natija sahifasiga o'tadi (yozuv allaqachon
 * bazada, "tayyorlanmoqda" holatida). Kuzatish esa shu yerda bo'ladi.
 * Uch afzallik:
 *
 *  1. URL darhol almashadi — foydalanuvchi sahifani yangilasa yoki
 *     havolani saqlasa, ish yo'qolmaydi.
 *  2. Foydalanuvchi boshqa sahifaga o'tib, keyin qaytib kelishi mumkin —
 *     tayyorlash serverda davom etadi.
 *  3. Forma sodda qoladi: yuboradi va o'tadi.
 *
 * ── Kutish matni HAQIQIY holatdan keladi ──────────────────────────────────
 * Ilgari bosqich matni SEKUNDOMERDAN hisoblanardi: o'tgan vaqtni odatdagi
 * davomiylikka bo'lib, "hozir shu bosqichda bo'lsa kerak" degan taxmin
 * ko'rsatilardi. Bu yolg'on edi — AI sekinlashsa matn oldinga ketardi,
 * tez tugasa orqada qolardi.
 *
 * Endi bosqich SERVERDAN keladi (`lib/generation/stages.ts`). Eski
 * yozuvlarda `stage` yo'q — u holda modulning o'z matni zaxira sifatida
 * ishlatiladi, ya'ni hech narsa buzilmaydi.
 *
 * Progress chizig'i vaqtga asoslangan bo'lib qoladi va bu ATAYLAB: u
 * "qancha qoldi" degan taxminni ko'rsatadi, bosqichni emas. Aynan shu
 * sababdan u 95% da to'xtaydi — to'liq to'lish faqat natija kelganda.
 *
 * Tugagach `router.refresh()` chaqiriladi — Server Component qayta
 * o'qiladi va tayyor natija ko'rinadi.
 */
export function GenerationProgress({
  resource,
  payloadKey,
  recordId,
  progressKeys,
  namespace,
  /** Odatdagi davomiylik, soniyada — matnda ko'rsatiladi. */
  typicalSeconds,
}: {
  resource: string;
  payloadKey: string;
  recordId: string;
  /** Bosqichli xabarlarning tarjima kalitlari. */
  progressKeys: readonly string[];
  /** Kalitlar qaysi bo'limda, masalan "lessonPlans". */
  namespace: string;
  typicalSeconds: number;
}) {
  const router = useRouter();
  const t = useTranslations(namespace);
  const tRoot = useTranslations();
  const tStages = useTranslations("common.stages");

  const { status, stage, elapsedSeconds, start, stop } = useGenerationPolling({
    resource,
    payloadKey,
  });

  /*
    Zaxira matn — faqat server bosqich bermagan holat uchun.

    Bu eski yozuvlarda (`stage = null`) va yangi yozuvning eng birinchi
    lahzasida (polling hali javob olmagan) ishlaydi. Sekundomerga
    asoslangani uchun u TAXMIN, shuning uchun faqat zaxira.
  */
  const stepSeconds = Math.max(3, Math.floor(typicalSeconds / progressKeys.length));
  const stepIndex = Math.min(
    Math.floor(elapsedSeconds / stepSeconds),
    progressKeys.length - 1,
  );

  /** Serverdagi bosqich tarjimada bormi. */
  const knownStage =
    stage !== null && tStages.has(stage)
      ? (stage as Parameters<typeof tStages>[0])
      : null;

  /*
    Chiziq 95% da to'xtaydi: "100%" ko'rsatib, keyin yana kutish —
    aldangandek tuyuladi. To'liq to'lish faqat natija kelganda bo'ladi.
  */
  const percent = Math.min(95, Math.round((elapsedSeconds / typicalSeconds) * 100));

  /*
    Kuzatuvni BOSHLASH va TO'XTATISH bitta effektda, simmetrik.

    ── Nega ilgari `startedRef` qo'riqchisi bor edi va nega u ZARARLI ──────
    Maqsad "har renderda yangi kuzatuv boshlanmasin" edi. Lekin `start`
    barqaror `useCallback` (uning barcha bog'liqliklari ham barqaror),
    shuning uchun effekt renderda qayta ishlamasdi — qo'riqchi ortiqcha edi.

    Zarari esa jiddiy bo'lib chiqdi. React StrictMode (Next dev'da standart)
    effektlarni ikki marta bajaradi: mount -> cleanup -> mount.

      1) 1-effekt:  startedRef = true, start() -> taymerlar va so'rov
      2) cleanup:   hookdagi `useEffect(() => stop)` -> stop():
                    ikkala interval o'chadi, so'rov abort qilinadi
      3) 2-effekt:  startedRef allaqachon true (ref remount'da saqlanadi)
                    -> ERTA QAYTISH, start() boshqa CHAQIRILMAYDI

    Natija: kuzatuv butunlay o'lik. Brauzerda aynan shu ko'rindi —
    bitta `net::ERR_ABORTED` so'rov, hisoblagich "0 soniya" da qotgan,
    holat hech qachon yangilanmagan. Nuqson uchala modulda ham bir xil,
    chunki ular shu bitta komponentni ishlatadi.

    Endi effekt simmetrik: har mountda start, har unmountda stop.
    StrictMode sikli to'g'ri yakunlanadi. `start()` o'zi ham ichida
    avval `stop()` chaqiradi, shuning uchun ikki marta boshlash xavfsiz.
  */
  useEffect(() => {
    start(recordId);
    return stop;
  }, [recordId, start, stop]);

  // Tugagach sahifani yangilaymiz — natija Server Component'dan keladi.
  useEffect(() => {
    if (status === "READY" || status === "FAILED") {
      router.refresh();
    }
  }, [status, router]);

  return (
    <ToneCard tone="accent" className="mt-6" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-full bg-surface text-accent"
        >
          <Sparkles className="size-7 animate-pulse" />
        </span>

        <p className="mt-4 text-lg font-semibold text-accent-ink">
          {tRoot("common.aiWorking")}
        </p>
        <p className="mt-2 text-base leading-relaxed text-accent-ink">
          {/*
            Serverdagi bosqich USTUN turadi. U bo'lmasa (eski yozuv yoki
            polling hali javob olmagan) modulning o'z matni ishlaydi.
          */}
          {knownStage !== null ? tStages(knownStage) : t(progressKeys[stepIndex])}
        </p>

        {/* Progress chizig'i — qancha qolganini ko'z bilan baholash uchun. */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={tRoot("common.aiWorking")}
          className="mt-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-3 text-base text-accent-ink">{tRoot("common.almostReady")}</p>

        <p className="mt-2 text-sm text-neutral-600">
          {tRoot("common.elapsedOfTypical", {
            elapsed: elapsedSeconds,
            typical: typicalSeconds,
          })}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {tRoot("common.canLeavePage")}
        </p>
      </div>
    </ToneCard>
  );
}
