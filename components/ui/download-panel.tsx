import type { ReactNode } from "react";
import { ToneCard } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";

/**
 * Tayyor materialni olish paneli.
 *
 * ── Nega bu ilovaning ENG katta tugmasi ───────────────────────────────────
 * Foydalanuvchi bu sahifaga bitta narsa uchun keladi — tayyor materialni
 * olish uchun. Shuning uchun birinchi (asosiy) tugma butun kenglikni
 * egallaydi, balandligi 56px va to'ldirilgan yashil fonda turadi: uni
 * izlash kerak emas.
 *
 * ── Bir nechta format ─────────────────────────────────────────────────────
 * Dastlab panel bitta faylga mo'ljallangan edi. Endi u ro'yxat qabul
 * qiladi: birinchi format — ASOSIY (katta, to'ldirilgan), qolganlari
 * yonma-yon ikkinchi darajali tugmalar.
 *
 * Nega barchasi bir xil emas: uchta bir xil katta tugma "qaysi birini
 * bosay?" degan savol tug'diradi. O'qituvchining 90% holatda kerak
 * bo'ladigan formati — birinchi, qolganlari esa bor, lekin e'tiborni
 * tortmaydi.
 *
 * ── Nega oddiy havola, `fetch` emas ───────────────────────────────────────
 * Brauzer faylni o'zi yuklab oladi va `Content-Disposition` sarlavhasidagi
 * nomni ishlatadi. Cookie avtomatik ketadi, ya'ni egalik tekshiruvi
 * ishlaydi. Telefon brauzerlarida ham shu yo'l ishonchli — blob orqali
 * saqlash iOS Safari'da ba'zan umuman ishlamaydi.
 */

export interface DownloadFormat {
  /** Tugma matni — harakatni aytadi ("Word'da yuklab olish"). */
  label: string;
  /** Fayl manzili. `action` berilgan bo'lsa `null`. */
  href: string | null;
  icon: ReactNode;
  /** Fayl hajmi, masalan "48 KB". Bo'lmasa ko'rsatilmaydi. */
  sizeLabel?: string;
  /** Havola emas, brauzer amali (masalan chop etish) bo'lsa. */
  action?: ReactNode;
}

export function DownloadPanel({
  title,
  hint,
  openWith,
  formats,
}: {
  title: string;
  hint: string;
  /** "Bu fayl … da ochiladi" — dastur nomi bilan. */
  openWith: string;
  /** Birinchisi ASOSIY tugma bo'ladi. */
  formats: DownloadFormat[];
}) {
  const [primary, ...secondary] = formats;

  return (
    <ToneCard tone="primary" className="mt-6">
      <p className="text-xl font-semibold text-primary-ink">{title}</p>
      <p className="mt-2 text-base leading-relaxed text-primary-ink">{hint}</p>

      {primary !== undefined && (
        <div className="mt-4">
          {primary.action ?? (
            <a href={primary.href ?? "#"} className={PRIMARY_CLASSES}>
              {primary.icon}
              {primary.label}
              {primary.sizeLabel !== undefined && (
                <span className="text-base font-normal opacity-80">
                  {primary.sizeLabel}
                </span>
              )}
            </a>
          )}
        </div>
      )}

      {secondary.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {secondary.map((format) => (
            <div key={format.label} className="flex-1">
              {format.action ?? (
                <a href={format.href ?? "#"} className={SECONDARY_CLASSES}>
                  {format.icon}
                  {format.label}
                  {format.sizeLabel !== undefined && (
                    <span className="text-sm font-normal text-neutral-500">
                      {format.sizeLabel}
                    </span>
                  )}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-base leading-relaxed text-neutral-600">{openWith}</p>
    </ToneCard>
  );
}

/*
  Class'lar shu yerda konstanta sifatida: `Button` komponenti `<button>`
  va `<Link>` uchun, bu yerda esa oddiy `<a>` kerak (brauzer faylni
  yuklab olishi uchun Next router aralashmasligi shart).
*/
const PRIMARY_CLASSES = cn(
  "flex min-h-14 w-full items-center justify-center gap-3 rounded-md",
  "bg-primary px-6 py-4 text-lg font-semibold text-on-primary shadow-card",
  "transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]",
);

export const SECONDARY_CLASSES = cn(
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-md",
  "border border-neutral-300 bg-surface px-4 py-2 text-base font-medium text-neutral-800",
  "transition-all duration-150 hover:border-neutral-400 hover:bg-neutral-100 active:scale-[0.98]",
);
