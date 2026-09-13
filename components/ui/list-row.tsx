"use client";

import { ChevronRight } from "lucide-react";
import { LinkCard } from "@/components/ui/card";
import { StatusBadge, type GenerationStatus } from "@/components/ui/badge";

/**
 * Ro'yxatdagi bitta yozuv.
 *
 * ── Nega umumiy ───────────────────────────────────────────────────────────
 * Uch modulning ro'yxati (dars ishlanmasi, prezentatsiya, kalendar reja)
 * bir xil ko'rinadi: sarlavha, tavsif, holat nishoni, sana. Ular uch
 * faylda alohida yozilgani uchun allaqachon bir-biridan farq qila
 * boshlagan edi.
 *
 * ── Telefonda ─────────────────────────────────────────────────────────────
 * 390px da sarlavha va nishon bir qatorga sig'maydi, shuning uchun
 * nishon pastga tushadi (`flex-col`), `sm` dan boshlab esa o'ng tomonda
 * turadi. Butun qator bosiladi.
 */
export function ListRow({
  href,
  title,
  meta,
  status,
  errorText,
  date,
  note,
}: {
  href: string;
  title: string;
  meta: string;
  status: GenerationStatus;
  /** Xato bo'lsa — INSON tilidagi jumla (texnik matn emas). */
  errorText?: string | null;
  date: string;
  /** Qo'shimcha izoh, masalan "dars ishlanmasi asosida". */
  note?: string | null;
}) {
  return (
    <LinkCard href={href} padding="sm" className="group">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 text-base leading-relaxed text-neutral-600">{meta}</p>
          {note !== null && note !== undefined && (
            <p className="mt-1 text-sm text-neutral-500">{note}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <ChevronRight
            aria-hidden
            className="hidden size-5 shrink-0 text-neutral-300 transition-colors group-hover:text-primary sm:block"
          />
        </div>
      </div>

      {errorText !== null && errorText !== undefined && (
        <p className="mt-3 text-base leading-relaxed text-danger-ink">{errorText}</p>
      )}

      <p className="mt-3 text-sm text-neutral-500">{date}</p>
    </LinkCard>
  );
}
