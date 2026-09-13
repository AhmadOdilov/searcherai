"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, Trash2 } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ToneCard } from "@/components/ui/card";

/**
 * Yozuv ustidagi amallar: qaytadan yaratish va o'chirish.
 *
 * ── Nega uchala modul uchun BITTA komponent ───────────────────────────────
 * Ilgari `lesson-plans/plan-actions.tsx`, `presentations/presentation-
 * actions.tsx` va `calendar-plans/plan-actions.tsx` deyarli belgima-belgi
 * bir xil edi (farq — manzil satri va bitta tarjima kaliti). Uch nusxa
 * uchta xil xatoga olib keladi: biri tuzatiladi, ikkitasi qoladi.
 *
 * ── O'chirish tasdiqlanadi, lekin `confirm()` bilan EMAS ──────────────────
 * Brauzerning `confirm()` oynasi inglizcha tugmalar bilan chiqadi va
 * sahifa ustida "muzlatib qo'yadi". Bu yerda tasdiq — o'sha joyning
 * o'zida: "O'chirilsinmi?" savoli va ikkita aniq tugma.
 */
export function RecordActions({
  resource,
  recordId,
  listHref,
  status,
  /** Kutish ogohlantirishi kalitining bo'limi (modulga xos matn). */
  waitNamespace,
}: {
  /** API manzili, masalan "/api/lesson-plans". */
  resource: string;
  recordId: string;
  /** O'chirilgach qayerga qaytariladi. */
  listHref: string;
  status: "PENDING" | "READY" | "FAILED";
  waitNamespace?: string;
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const tWait = useTranslations(waitNamespace ?? "common");

  const [busy, setBusy] = useState<null | "retry" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleRetry() {
    setBusy("retry");
    setError(null);
    try {
      await apiRequest(`${resource}/${recordId}/regenerate`, { method: "POST" });
      // Server Component'ni qayta o'qitadi — yangi natija ko'rinadi.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t("unexpectedError"));
    }
    setBusy(null);
  }

  async function handleDelete() {
    setBusy("delete");
    setError(null);
    try {
      await apiRequest(`${resource}/${recordId}`, { method: "DELETE" });
      router.replace(listHref);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t("unexpectedError"));
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* Qaytadan yaratish xato holatida ASOSIY amal (to'ldirilgan
            tugma), tayyor holatda esa ikkinchi darajali — o'qituvchi
            natija yoqmasa boshqasini olishi mumkin. */}
        <Button
          variant={status === "FAILED" ? "primary" : "secondary"}
          size={status === "FAILED" ? "lg" : "md"}
          onClick={handleRetry}
          disabled={busy !== null}
          loading={busy === "retry"}
          icon={
            busy === "retry" ? undefined : <RefreshCw aria-hidden className="size-5" />
          }
        >
          {busy === "retry"
            ? t("regenerating")
            : status === "FAILED"
              ? t("retry")
              : t("regenerate")}
        </Button>

        {confirmingDelete ? (
          <>
            <span className="text-base font-medium text-neutral-800">
              {t("confirmDelete")}
            </span>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={busy !== null}
              loading={busy === "delete"}
            >
              {busy === "delete" ? t("deleting") : t("confirmDeleteYes")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy !== null}
            >
              {t("cancel")}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy !== null}
            icon={<Trash2 aria-hidden className="size-5" />}
          >
            {t("delete")}
          </Button>
        )}
      </div>

      {error !== null && (
        <div className="mt-4">
          <ToneCard tone="danger" padding="sm" role="alert">
            <p className="text-base leading-relaxed text-danger-ink">{error}</p>
          </ToneCard>
        </div>
      )}

      {busy === "retry" && (
        <p aria-live="polite" className="mt-3 text-base text-neutral-600">
          {tWait("doNotClosePage")}
        </p>
      )}
    </div>
  );
}
