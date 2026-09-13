"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { SECONDARY_CLASSES } from "@/components/ui/download-panel";

/**
 * "PDF qilib saqlash" tugmasi — brauzerning chop etish oynasi orqali.
 *
 * ── Nega PDF kutubxonasi EMAS ─────────────────────────────────────────────
 * Serverda PDF yasash uchun yo headless brauzer (~300 MB image, sekin),
 * yo PDF kutubxonasi kerak. Ikkinchisida o'zbek lotin (`o'`, `g'`) va
 * kirill harflari uchun shriftni hujjatga embed qilish kerak bo'ladi —
 * bu qo'shimcha 1-2 MB va alohida sinov.
 *
 * Brauzerning o'z chop etish oynasi esa allaqachon bor va uchala
 * platformada "PDF qilib saqlash" tanlovini beradi:
 *   · Windows/macOS — "Destination: Save as PDF"
 *   · Android Chrome — "Save as PDF"
 *   · iOS Safari — "Ulashish → Fayllarga saqlash"
 *
 * Ya'ni bir qator kod bilan haqiqiy PDF chiqadi, chop etish uslublari
 * (`globals.css` dagi `@media print`) esa sahifani hujjatga o'xshatadi:
 * tugmalar, sarlavha va yordam havolasi olib tashlanadi.
 */
export function PrintButton() {
  const t = useTranslations("common");

  return (
    <button type="button" onClick={() => window.print()} className={SECONDARY_CLASSES}>
      <Printer aria-hidden className="size-5 shrink-0" />
      {t("saveAsPdf")}
    </button>
  );
}
