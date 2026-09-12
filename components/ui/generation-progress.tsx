"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGenerationPolling } from "@/lib/hooks/use-generation-polling";

/**
 * Fon rejimidagi generatsiyani kuzatib, tugagach sahifani yangilaydi.
 *
 * ── Nega natija sahifasida, formada emas ──────────────────────────────────
 * Forma POST yuborgach DARHOL natija sahifasiga o'tadi (yozuv allaqachon
 * bazada, PENDING holatida). Kuzatish esa shu yerda bo'ladi. Uch afzallik:
 *
 *  1. URL darhol almashadi — foydalanuvchi sahifani yangilasa yoki
 *     havolani saqlasa, ish yo'qolmaydi.
 *  2. Foydalanuvchi boshqa sahifaga o'tib, keyin qaytib kelishi mumkin —
 *     generatsiya serverda davom etadi.
 *  3. Forma sodda qoladi: yuboradi va o'tadi.
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
    <div
      aria-live="polite"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center"
    >
      <div className="flex items-center justify-center gap-2">
        {/* Oddiy aylanuvchi indikator — kutish jarayoni ko'rinib tursin. */}
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700"
        />
        <p className="text-sm font-medium text-amber-900">{t(progressKeys[stepIndex])}</p>
      </div>

      <p className="mt-1.5 text-xs text-amber-700">
        {tRoot("common.elapsedOfTypical", {
          elapsed: elapsedSeconds,
          typical: typicalSeconds,
        })}
      </p>

      <p className="mt-2 text-xs text-amber-600">{tRoot("common.canLeavePage")}</p>
    </div>
  );
}
