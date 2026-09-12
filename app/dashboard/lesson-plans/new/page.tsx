"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { DURATION_OPTIONS } from "@/lib/lesson-plans/labels";
import { LESSON_TYPES, GENERATION_LANGUAGES } from "@/lib/ui/options";

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

interface CreatedPlan {
  lessonPlan: { id: string };
}

export default function NewLessonPlanPage() {
  const router = useRouter();
  const t = useTranslations("lessonPlans");
  const tRoot = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

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
        setFormError(tRoot("common.unexpectedError"));
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/lesson-plans"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← {tRoot("common.back")}
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-slate-900">{t("new.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("new.subtitle")}</p>

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
          label={t("fields.subject")}
          name="subject"
          placeholder={t("fields.subjectPlaceholder")}
          errors={fieldErrors}
          disabled={submitting}
        />
        <TextField
          label={t("fields.grade")}
          name="grade"
          placeholder={t("fields.gradePlaceholder")}
          errors={fieldErrors}
          disabled={submitting}
        />
        <TextField
          label={t("fields.topic")}
          name="topic"
          placeholder={t("fields.topicPlaceholder")}
          errors={fieldErrors}
          disabled={submitting}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            label={t("fields.duration")}
            name="durationMinutes"
            defaultValue="45"
            options={DURATION_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: t("fields.durationOption", { minutes }),
            }))}
            errors={fieldErrors}
            disabled={submitting}
          />
          <SelectField
            label={t("fields.lessonType")}
            name="lessonType"
            defaultValue="NEW_TOPIC"
            options={LESSON_TYPES.map((value) => ({
              value,
              label: t(`types.${value}`),
            }))}
            errors={fieldErrors}
            disabled={submitting}
          />
          {/*
            DIQQAT: bu GENERATSIYA tili — dars ishlanmasi qaysi tilda
            yoziladi. Interfeys tilidan MUSTAQIL: o'qituvchi interfeysni
            ruscha ishlatib, darsni o'zbekcha so'rashi mumkin.
          */}
          <SelectField
            label={tRoot("common.language")}
            name="language"
            defaultValue="UZ"
            options={GENERATION_LANGUAGES.map((value) => ({
              value,
              label: tRoot(`languages.${value}`),
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
          {submitting ? tRoot("common.creating") : t("new.submit")}
        </button>
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
