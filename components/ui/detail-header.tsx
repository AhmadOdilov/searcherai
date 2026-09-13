import type { ReactNode } from "react";
import { StatusBadge, type GenerationStatus } from "@/components/ui/badge";

/**
 * Natija sahifasining sarlavhasi.
 *
 * Uch modulda bir xil: nom, holat nishoni, tavsif qatori va sana.
 *
 * ── Telefonda tartib ──────────────────────────────────────────────────────
 * 390px da nishon sarlavhaning YONIDA emas, TAGIDA turadi — aks holda
 * uzun mavzu nomi bir belgigacha siqilib ketadi.
 */
export function DetailHeader({
  title,
  status,
  meta,
  date,
  extra,
}: {
  title: string;
  status: GenerationStatus;
  meta: ReactNode;
  date: string;
  extra?: ReactNode;
}) {
  return (
    <header className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h1>
        <div className="shrink-0">
          <StatusBadge status={status} />
        </div>
      </div>

      <p className="mt-3 text-base leading-relaxed text-neutral-600">{meta}</p>
      <p className="mt-1 text-sm text-neutral-500">{date}</p>
      {extra}
    </header>
  );
}
