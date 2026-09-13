import type { ReactNode } from "react";

/**
 * Bo'sh ro'yxat ekrani.
 *
 * ── Nega alohida komponent ────────────────────────────────────────────────
 * Bo'sh ekran — yangi foydalanuvchi eng ko'p ko'radigan ekran. U
 * "bo'sh" demasligi, balki NIMA QILISH kerakligini aytishi kerak:
 * katta belgi, bitta jumla tushuntirish va bitta katta tugma.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-surface p-6 text-center sm:p-10">
      <span
        aria-hidden
        className="mx-auto flex size-16 items-center justify-center rounded-xl bg-primary-soft text-primary"
      >
        {icon}
      </span>

      <p className="mt-4 text-xl font-semibold text-neutral-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-neutral-600">
        {description}
      </p>

      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  );
}
