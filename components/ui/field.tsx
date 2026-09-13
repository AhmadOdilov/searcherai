"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/**
 * Forma maydonlari — Input, Textarea, Select.
 *
 * ── Uchalasi bir faylda, chunki ular BIR XIL qobiqni baham ko'radi ────────
 * Yorliq, izoh, xato matni, `aria-*` bog'lanishlari, fokus halqasi —
 * hammasi `FieldShell` da. Ilgari bu mantiq uch sahifada uch marta
 * nusxalangan edi va ular allaqachon bir-biridan farq qila boshlagandi.
 *
 * ── Maydon balandligi ─────────────────────────────────────────────────────
 * `min-h-11` (44px) va `text-base` (16px). 16px'dan kichik shrift
 * iOS Safari'da maydonga tegilganda sahifani zo'rlab kattalashtiradi —
 * o'qituvchi keyin uni qo'lda qaytarib kichraytirishga majbur bo'ladi.
 */

interface FieldShellProps {
  label: string;
  /** Maydon `id` va `name` — yorliq bilan bog'lash uchun. */
  name: string;
  /** Doim ko'rinadigan kichik izoh ("kamida 8 belgi"). */
  hint?: string;
  /**
   * "?" tugmasi ostidagi tushuntirish: bu maydon NEGA kerak.
   * Doim ko'rinmaydi — formani matn bilan to'ldirib yubormaslik uchun.
   */
  help?: string;
  errors?: Record<string, string[]>;
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

function FieldShell({ label, name, hint, help, errors, children }: FieldShellProps) {
  const fieldErrors = errors?.[name];
  const invalid = fieldErrors !== undefined && fieldErrors.length > 0;

  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const helpId = `${name}-help`;

  const [helpOpen, setHelpOpen] = useState(false);

  const describedBy =
    [invalid ? errorId : hint !== undefined ? hintId : null, helpOpen ? helpId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={name} className="block text-base font-medium text-neutral-800">
          {label}
        </label>

        {help !== undefined && (
          <button
            type="button"
            onClick={() => setHelpOpen((open) => !open)}
            aria-expanded={helpOpen}
            aria-controls={helpId}
            // Belgi o'zi ma'no bermaydi — skrinriderga so'z bilan aytamiz.
            aria-label={label}
            /*
              Ko'rinishi kichik (20px belgi), lekin TEGISH maydoni 44px —
              manfiy tashqi bo'shliq yorliq qatorini kengaytirmaydi.
              Telefonda kichik nishonga tegib bo'lmaydi.
            */
            className="-my-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary"
          >
            <HelpCircle aria-hidden className="size-5" />
          </button>
        )}
      </div>

      {help !== undefined && helpOpen && (
        <p
          id={helpId}
          className="mb-2 rounded-md border border-primary-border bg-primary-soft px-3 py-2 text-sm text-primary-ink"
        >
          {help}
        </p>
      )}

      {children({ id: name, describedBy, invalid })}

      {invalid ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-danger">
          {fieldErrors.join(" ")}
        </p>
      ) : hint !== undefined ? (
        <p id={hintId} className="mt-2 text-sm text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Maydon ko'rinishi.
 *
 * Fokusda chegara brend rangiga aylanadi VA halqa paydo bo'ladi —
 * ikkalasi birga, chunki faqat rang o'zgarishi rang ajratolmaydigan
 * foydalanuvchiga hech narsa aytmaydi.
 */
function controlClasses(invalid: boolean): string {
  return cn(
    "block min-h-11 w-full rounded-md border bg-surface px-3 py-2 text-base text-neutral-900",
    "outline-none transition-colors duration-150",
    "placeholder:text-neutral-400",
    "disabled:bg-neutral-100 disabled:text-neutral-500",
    invalid
      ? "border-danger focus:border-danger focus:ring-3 focus:ring-danger-border"
      : "border-neutral-300 focus:border-primary focus:ring-3 focus:ring-primary-border",
  );
}

type FieldBase = Pick<FieldShellProps, "label" | "name" | "hint" | "help" | "errors">;

export function Input({
  label,
  name,
  hint,
  help,
  errors,
  className,
  ...rest
}: FieldBase &
  Omit<ComponentProps<"input">, "name" | "id" | "className"> & { className?: string }) {
  return (
    <FieldShell label={label} name={name} hint={hint} help={help} errors={errors}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          name={name}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(controlClasses(invalid), className)}
        />
      )}
    </FieldShell>
  );
}

export function Textarea({
  label,
  name,
  hint,
  help,
  errors,
  className,
  rows = 4,
  ...rest
}: FieldBase &
  Omit<ComponentProps<"textarea">, "name" | "id" | "className"> & {
    className?: string;
  }) {
  return (
    <FieldShell label={label} name={name} hint={hint} help={help} errors={errors}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          name={name}
          rows={rows}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(controlClasses(invalid), "min-h-24 leading-relaxed", className)}
        />
      )}
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  label,
  name,
  hint,
  help,
  errors,
  options,
  className,
  ...rest
}: FieldBase &
  Omit<ComponentProps<"select">, "name" | "id" | "className" | "children"> & {
    options: readonly SelectOption[];
    className?: string;
  }) {
  return (
    <FieldShell label={label} name={name} hint={hint} help={help} errors={errors}>
      {({ id, describedBy, invalid }) => (
        /*
          Strelka — HAQIQIY belgi, `background-image` emas.

          Ilgari u SVG'ning data-URI si edi va rangi qattiq yozilgandi
          (#7c7467). Qorong'i rejimda u fonga singib ketardi. Belgi
          `currentColor` ni oladi, ya'ni token bilan birga o'zgaradi.
        */
        <div className="relative">
          <select
            {...rest}
            id={id}
            name={name}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(controlClasses(invalid), "appearance-none pr-11", className)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-neutral-500"
          />
        </div>
      )}
    </FieldShell>
  );
}

/** Forma ustidagi umumiy xato xabari. */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-danger-border bg-danger-soft px-4 py-3 text-base text-danger-ink"
    >
      {message}
    </p>
  );
}
