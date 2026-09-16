"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "@/lib/hooks/use-editor-draft";

/**
 * Saqlash paneli — muharrirning pastida yopishib turadi.
 *
 * ── Nega YOPISHGAN (sticky) ───────────────────────────────────────────────
 * Muharrir uzun: 20 slaydli prezentatsiyada "Saqlash" tugmasi sahifaning
 * eng pastida qolardi. O'qituvchi o'rtada bir narsani tuzatib, saqlash
 * tugmasini topolmay sahifadan chiqib ketishi mumkin edi — ish yo'qoladi.
 *
 * ── Nega holat MATN bilan ham aytiladi ────────────────────────────────────
 * Faqat rang bilan ("yashil = saqlandi") ko'rsatish rang ajrata olmaydigan
 * foydalanuvchi uchun hech narsa bildirmaydi. Shuning uchun har holatda
 * matn ham bor va u `aria-live` bilan e'lon qilinadi.
 *
 * ── Soxta progress yo'q ───────────────────────────────────────────────────
 * "Saqlanmoqda…" faqat so'rov ketayotganda ko'rinadi, "Saqlandi" faqat
 * server tasdiqlagach. Oraliq foiz yoki animatsiya yo'q: amal odatda bir
 * soniyadan kam davom etadi va soxta bosqichlar faqat chalg'itardi.
 */
export function SaveBar({
  dirty,
  status,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  status: SaveStatus;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("editor");

  const saving = status === "saving";

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-neutral-200 bg-surface/95 px-4 py-3 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
        {/*
          Holat matni chapda va o'sadigan bo'shliqni egallaydi — tugmalar
          telefonda ham o'ng chetda, bir xil joyda qoladi.
        */}
        <p
          aria-live="polite"
          className="mr-auto flex min-h-6 items-center gap-2 text-base"
        >
          {status === "saving" && (
            <span className="text-neutral-600">{t("status.saving")}</span>
          )}
          {status === "saved" && (
            <span className="flex items-center gap-2 text-success">
              <Check aria-hidden className="size-5 shrink-0" />
              {t("status.saved")}
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-2 text-danger">
              <AlertTriangle aria-hidden className="size-5 shrink-0" />
              {t("status.failed")}
            </span>
          )}
          {status === "idle" && dirty && (
            <span className="text-accent-ink">{t("status.unsaved")}</span>
          )}
        </p>

        {dirty && (
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            {t("discard")}
          </Button>
        )}

        <Button
          onClick={onSave}
          // Saqlanmagan o'zgarish bo'lmasa tugma ish bermaydi — uni
          // o'chirib qo'yish "nega hech narsa bo'lmadi?" savolini oldini oladi.
          disabled={!dirty || saving}
          loading={saving}
          icon={saving ? undefined : <Save aria-hidden className="size-5" />}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
