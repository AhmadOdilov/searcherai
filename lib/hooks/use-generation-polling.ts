"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  POLL_INTERVAL_MS,
  POLL_MAX_ERRORS,
  POLL_TIMEOUT_MS,
} from "@/lib/generation/constants";

/**
 * Fon rejimidagi generatsiyani kuzatish.
 *
 * ── Oqim ──────────────────────────────────────────────────────────────────
 *  1. Forma `POST` yuboradi → server `202` va PENDING yozuvni qaytaradi
 *  2. Bu hook `GET /api/{resource}/{id}` ni har 2 soniyada so'raydi
 *  3. Status READY yoki FAILED bo'lgach TO'XTAYDI
 *
 * ── To'xtash shartlari (cheksiz aylanmaslik uchun) ────────────────────────
 *  · status READY yoki FAILED — asosiy holat
 *  · umumiy vaqt `timeoutMs` dan oshdi — server osilib qolgan bo'lsa
 *  · ketma-ket xatolar soni `maxErrors` dan oshdi — tarmoq uzilgan bo'lsa
 *  · komponent yopildi — `AbortController` so'rovni bekor qiladi
 *
 * Serverda ham himoya bor: `markStaleAsFailed()` uzoq PENDING turgan
 * yozuvni FAILED qiladi. Ya'ni ikki tomondan ham cheksiz kutish yo'q.
 */

export type GenerationStatus = "PENDING" | "READY" | "FAILED";

interface PollableRecord {
  id: string;
  status: GenerationStatus;
  errorMessage: string | null;
}

export interface UseGenerationPollingOptions {
  /** API yo'li, masalan "/api/lesson-plans". */
  resource: string;
  /** Javob tanasidagi kalit, masalan "lessonPlan". */
  payloadKey: string;
  /** So'rovlar orasidagi oraliq. */
  intervalMs?: number;
  /** Umumiy chegara — shundan keyin to'xtaydi. */
  timeoutMs?: number;
  /** Ketma-ket nechta xatodan keyin to'xtaydi. */
  maxErrors?: number;
}

export interface UseGenerationPollingResult {
  /** Joriy holat. `null` — hali hech narsa kuzatilmayapti. */
  status: GenerationStatus | null;
  /** Kuzatish davom etyaptimi. */
  polling: boolean;
  /** Boshlangandan beri o'tgan soniyalar — UI'da ko'rsatish uchun. */
  elapsedSeconds: number;
  /** Xatolik xabari (kalit yoki matn), bo'lsa. */
  error: string | null;
  /** Kuzatishni boshlaydi. */
  start: (id: string) => void;
  /** Kuzatishni to'xtatadi. */
  stop: () => void;
}

export function useGenerationPolling(
  options: UseGenerationPollingOptions,
): UseGenerationPollingResult {
  const {
    resource,
    payloadKey,
    intervalMs = POLL_INTERVAL_MS,
    // Serverdagi `STALE_AFTER_MS` dan uzunroq — izohni
    // `lib/generation/constants.ts` da qara.
    timeoutMs = POLL_TIMEOUT_MS,
    maxErrors = POLL_MAX_ERRORS,
  } = options;

  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /*
    Kuzatuv holati `ref` da saqlanadi, `state` da emas.

    Sabab: `setInterval` callback'i o'zi yaratilgan paytdagi `state` ni
    "eslab qoladi" (closure). `ref` esa har doim joriy qiymatni beradi,
    shuning uchun to'xtatish ishonchli ishlaydi.
  */
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);
  const errorCountRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (clockRef.current !== null) {
      clearInterval(clockRef.current);
      clockRef.current = null;
    }
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPolling(false);
  }, []);

  const start = useCallback(
    (id: string) => {
      // Avvalgi kuzatuv qolgan bo'lsa to'xtatamiz — ikkita bir vaqtda
      // ishlamasin.
      stop();

      setStatus("PENDING");
      setError(null);
      setElapsedSeconds(0);
      setPolling(true);
      startedAtRef.current = Date.now();
      errorCountRef.current = 0;

      clockRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);

      const check = async () => {
        // Umumiy chegara
        if (Date.now() - startedAtRef.current > timeoutMs) {
          stop();
          setStatus("FAILED");
          setError("errors.domain.generationTimedOut");
          return;
        }

        const controller = new AbortController();
        controllerRef.current = controller;

        try {
          const data = await apiRequest<Record<string, PollableRecord>>(
            `${resource}/${id}`,
            { signal: controller.signal },
          );
          const record = data[payloadKey];
          errorCountRef.current = 0;

          if (record.status === "READY" || record.status === "FAILED") {
            stop();
            setStatus(record.status);
            if (record.status === "FAILED") {
              setError(record.errorMessage ?? "errors.unknown");
            }
          }
        } catch (caught) {
          // Bekor qilingan so'rov — komponent yopildi, xato emas.
          if (caught instanceof Error && caught.name === "AbortError") return;

          errorCountRef.current += 1;
          if (errorCountRef.current >= maxErrors) {
            stop();
            setStatus("FAILED");
            setError(
              caught instanceof ApiClientError ? caught.message : "errors.unknown",
            );
          }
          // Aks holda keyingi urinishda davom etamiz — bitta uzilish
          // butun kuzatuvni to'xtatmasligi kerak.
        }
      };

      timerRef.current = setInterval(() => void check(), intervalMs);
      // Birinchi tekshiruvni darhol qilamiz — generatsiya tez tugagan
      // bo'lsa 2 soniya kutib o'tirmaymiz.
      void check();
    },
    [resource, payloadKey, intervalMs, timeoutMs, maxErrors, stop],
  );

  // Komponent yopilganda tozalash — aks holda so'rovlar davom etadi.
  useEffect(() => stop, [stop]);

  return { status, polling, elapsedSeconds, error, start, stop };
}
