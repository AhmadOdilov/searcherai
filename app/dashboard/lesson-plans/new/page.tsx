"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  DURATION_OPTIONS,
  LANGUAGE_LABELS,
  LESSON_TYPE_LABELS,
} from "@/lib/lesson-plans/labels";

/**
 * `/dashboard/lesson-plans/new` — dars ishlanmasi yaratish formasi.
 *
 * ── Loading holati nega bu darajada batafsil ──────────────────────────────
 * AI javobi 5–40 soniya olishi mumkin. Oddiy "Yuklanmoqda…" yozuvi bunday
 * uzoq kutishda foydalanuvchini "osilib qoldi" deb o'ylashga majbur qiladi.
 * Shuning uchun bosqichli matn ko'rsatiladi — jarayon davom etayotgani
 * ko'rinib turadi.
 *
 * (Haqiqiy streaming — ya'ni AI matnini kelishi bilan ko'rsatish — Step 5
 * performance bosqichida qo'shiladi.)
 */

const PROGRESS_MESSAGES = [
  "So'rov yuborildi…",
  "Dars maqsadi belgilanmoqda…",
  "Bosqichlar va vaqt taqsimoti tuzilmoqda…",
  "Resurslar va baholash mezonlari qo'shilmoqda…",
  "Yakunlanmoqda…",
];

interface CreatedPlan {
  lessonPlan: { id: string };
}

export default function NewLessonPlanPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setProgressIndex(0);

    // Bosqichli xabarlarni almashtiramiz — kutish "tirik" ko'rinsin.
    const ticker = setInterval(() => {
      setProgressIndex((current) => Math.min(current + 1, PROGRESS_MESSAGES.length - 1));
    }, 4000);

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const created = await apiRequest<CreatedPlan>("/api/lesson-plans", {
        method: "POST",
        body,
      });
      // Natija sahifasiga o'tamiz. `replace` — "orqaga" tugmasi formani
      // qaytadan ko'rsatmasin (va takroran yubormasin).
      router.replace(`/dashboard/lesson-plans/${created.lessonPlan.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        else setFormError(error.message);
      } else {
        setFormError("Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.");
      }
      setSubmitting(false);
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/lesson-plans"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← Ro&apos;yxatga qaytish
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-slate-900">Yangi dars ishlanmasi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Parametrlarni kiriting — qolganini tizim o&apos;zi tuzadi.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      >
        {formError !== null && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <TextField
          label="Fan"
          name="subject"
          placeholder="Matematika"
          errors={fieldErrors}
          disabled={submitting}
        />
        <TextField
          label="Sinf / daraja"
          name="grade"
          placeholder="7-sinf"
          errors={fieldErrors}
          disabled={submitting}
        />
        <TextField
          label="Mavzu"
          name="topic"
          placeholder="Kasrlarni qo'shish va ayirish"
          errors={fieldErrors}
          disabled={submitting}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            label="Davomiylik"
            name="durationMinutes"
            defaultValue="45"
            options={DURATION_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: `${minutes} daqiqa`,
            }))}
            errors={fieldErrors}
            disabled={submitting}
          />
          <SelectField
            label="Dars turi"
            name="lessonType"
            defaultValue="NEW_TOPIC"
            options={Object.entries(LESSON_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            errors={fieldErrors}
            disabled={submitting}
          />
          <SelectField
            label="Til"
            name="language"
            defaultValue="UZ"
            options={Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            errors={fieldErrors}
            disabled={submitting}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Yaratilmoqda…" : "Dars ishlanmasini yaratish"}
        </button>

        {submitting && (
          <div
            // Skrinrider o'zgarishni o'qishi uchun.
            aria-live="polite"
            className="rounded-lg bg-slate-50 px-3 py-3 text-center"
          >
            <p className="text-sm text-slate-700">{PROGRESS_MESSAGES[progressIndex]}</p>
            <p className="mt-1 text-xs text-slate-400">
              Bu 30 soniyagacha davom etishi mumkin — sahifani yopmang.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}

// ─── Forma maydonlari ────────────────────────────────────────────────────────

interface FieldBaseProps {
  label: string;
  name: string;
  errors: Record<string, string[]>;
  disabled?: boolean;
}

function FieldWrapper({
  label,
  name,
  errors,
  children,
}: FieldBaseProps & { children: React.ReactNode }) {
  const fieldErrors = errors[name];
  const hasError = fieldErrors !== undefined && fieldErrors.length > 0;

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hasError && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600">
          {fieldErrors.join(" ")}
        </p>
      )}
    </div>
  );
}

function inputClasses(hasError: boolean): string {
  return `w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-slate-300 focus:border-slate-400 focus:ring-slate-100"
  }`;
}

function TextField({
  label,
  name,
  placeholder,
  errors,
  disabled,
}: FieldBaseProps & { placeholder?: string }) {
  const hasError = (errors[name]?.length ?? 0) > 0;

  return (
    <FieldWrapper label={label} name={name} errors={errors}>
      <input
        id={name}
        name={name}
        type="text"
        required
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
        className={inputClasses(hasError)}
      />
    </FieldWrapper>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  errors,
  disabled,
}: FieldBaseProps & {
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  const hasError = (errors[name]?.length ?? 0) > 0;

  return (
    <FieldWrapper label={label} name={name} errors={errors}>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
        className={inputClasses(hasError)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
