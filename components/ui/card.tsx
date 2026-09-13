import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * Karta — oq sirt, yumshoq chegara, iliq soya.
 *
 * Uch ko'rinish:
 *  · `Card` — oddiy quti (forma, natija bloki).
 *  · `LinkCard` — BUTUNLAY bosiladigan karta (ro'yxat elementi, modul).
 *  · `ToneCard` — rangli holat kartasi (tayyor / ogohlantirish / xato).
 */

export type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

const BASE = "rounded-lg border border-neutral-200 bg-surface";

export function Card({
  padding = "md",
  className,
  children,
  ...rest
}: Omit<ComponentProps<"div">, "className"> & {
  padding?: CardPadding;
  className?: string;
}) {
  return (
    <div
      {...rest}
      className={cn(BASE, "shadow-card", PADDING_CLASSES[padding], className)}
    >
      {children}
    </div>
  );
}

/**
 * Bosiladigan karta.
 *
 * BUTUN karta havola — faqat ichidagi sarlavha emas. Telefonda kichik
 * havolaga tegish qiyin; katta nishon esa xato bosishni deyarli yo'q
 * qiladi.
 *
 * Sichqoncha ustiga kelganda karta biroz "ko'tariladi" (soya kattalashadi,
 * 2px yuqoriga siljiydi) — bu uning bosilishini aytadi.
 */
export function LinkCard({
  href,
  padding = "md",
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof Link>, "className"> & {
  padding?: CardPadding;
  className?: string;
}) {
  return (
    <Link
      {...rest}
      href={href}
      className={cn(
        BASE,
        "block shadow-card transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary-border hover:shadow-card-hover",
        "active:translate-y-0 active:shadow-card",
        PADDING_CLASSES[padding],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export type CardTone = "primary" | "accent" | "danger" | "neutral";

const TONE_CLASSES: Record<CardTone, string> = {
  primary: "border-primary-border bg-primary-soft",
  accent: "border-accent-border bg-accent-soft",
  danger: "border-danger-border bg-danger-soft",
  neutral: "border-neutral-200 bg-neutral-50",
};

/** Rangli holat kartasi — tayyor natija, ogohlantirish, xato. */
export function ToneCard({
  tone,
  padding = "md",
  className,
  children,
  ...rest
}: Omit<ComponentProps<"div">, "className"> & {
  tone: CardTone;
  padding?: CardPadding;
  className?: string;
}) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-lg border",
        TONE_CLASSES[tone],
        PADDING_CLASSES[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Sahifa sarlavhasi — hamma sahifada bir xil joylashuv. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** O'ng tomondagi asosiy amal (telefonda pastga tushadi). */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h1>
        {description !== undefined && (
          <p className="mt-2 text-base text-neutral-600">{description}</p>
        )}
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Forma ichidagi raqamlangan bo'lim.
 *
 * ── Nega formani bosqichlarga BO'LMADIK ───────────────────────────────────
 * "1/3 → 2/3 → 3/3" ko'rinishi uzun formalarda yordam beradi, lekin bu
 * yerda maydonlar oltitadan oshmaydi. Bosqichlarga bo'lish uchta zarar
 * keltiradi: qo'shimcha bosishlar, "orqaga" tugmasi bilan chalkashlik va
 * to'ldirilgan ma'lumotni bir ko'z bilan ko'ra olmaslik.
 *
 * Shuning uchun forma bitta sahifada qoldi, lekin raqamlangan bo'limlarga
 * ajratildi: foydalanuvchi qayerda turganini ko'radi, hech qayerga
 * o'tmasdan.
 */
export function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-semibold text-primary"
        >
          {step}
        </span>
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      </div>

      {description !== undefined && (
        <p className="mt-2 text-base leading-relaxed text-neutral-600">{description}</p>
      )}

      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}
