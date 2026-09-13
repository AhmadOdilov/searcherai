"use client";

import { useEffect, useRef } from "react";
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
 * ── Kutish matni haqida ───────────────────────────────────────────────────
 * Kutish — ilovaning eng xavfli lahzasi: aynan shu yerda odam "osilib
 * qoldi" deb o'ylab sahifani yopadi. Shuning uchun:
 *  · matn har necha soniyada o'zgaradi (jarayon TIRIK ekani ko'rinadi),
 *  · progress chizig'i taxminiy vaqtga nisbatan to'ladi,
 *  · "tez orada tayyor bo'ladi" degan tinchlantiruvchi jumla turadi,
 *  · sahifani yopsa ham ish yo'qolmasligi AYTILADI.
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

  const { status, elapsedSeconds, start } = useGenerationPolling({
    resource,
    payloadKey,
  });

  // Har bir bosqich uchun taxminiy vaqt — matn "tirik" ko'rinsin.
  const stepSeconds = Math.max(3, Math.floor(typicalSeconds / progressKeys.length));
  const stepIndex = Math.min(
    Math.floor(elapsedSeconds / stepSeconds),
    progressKeys.length - 1,
  );

  /*
    Chiziq 95% da to'xtaydi: "100%" ko'rsatib, keyin yana kutish —
    aldangandek tuyuladi. To'liq to'lish faqat natija kelganda bo'ladi.
  */
  const percent = Math.min(95, Math.round((elapsedSeconds / typicalSeconds) * 100));

  // `start` faqat BIR MARTA chaqirilishi kerak — aks holda har renderda
  // yangi kuzatuv boshlanardi.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start(recordId);
  }, [recordId, start]);

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
          {t(progressKeys[stepIndex])}
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
