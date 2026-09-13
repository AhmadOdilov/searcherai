import { AlertTriangle } from "lucide-react";
import { ToneCard } from "@/components/ui/card";

/**
 * Generatsiya yiqilganda ko'rsatiladigan panel.
 *
 * Uch modulda ham bir xil edi — shuning uchun umumiy komponentga
 * chiqarildi. Matnlar tashqaridan tayyor tarjima sifatida keladi, chunki
 * har bir modulning o'z sarlavhasi bor.
 *
 * ── Nima ko'rsatiladi ─────────────────────────────────────────────────────
 * Sarlavha — nima bo'lgani, keyin NIMA QILISH kerakligi. Texnik matn
 * (`AiError: 500 ...`) hech qachon bu yerga tushmaydi: `message` doim
 * tarjima qilingan, inson tilidagi jumla.
 */
export function ErrorPanel({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint: string;
}) {
  return (
    <ToneCard tone="danger" className="mt-6" role="alert">
      <div className="flex gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 size-6 shrink-0 text-danger" />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-danger-ink">{title}</p>
          <p className="mt-2 text-base leading-relaxed text-danger-ink">{message}</p>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">{hint}</p>
        </div>
      </div>
    </ToneCard>
  );
}
