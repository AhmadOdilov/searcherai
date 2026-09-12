"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { GENERATION_LANGUAGES } from "@/lib/ui/options";
import {
  HOURS_PER_WEEK_OPTIONS,
  PERIOD_PRESETS,
  toDateInputValue,
} from "@/lib/calendar-plans/labels";

/**
 * `/dashboard/calendar-plans/new` — kalendar reja yaratish formasi.
 *
 * ── Nega kutish ogohlantirishi boshqalardan kuchliroq ─────────────────────
 * Bu modul eng sekin: 30-70 qatorli javob 40-60 soniya olishi mumkin
 * (boshqa modullarda 5-15 soniya). Foydalanuvchi bu qadar uzoq kutishga
 * TAYYORLANMAGAN bo'lsa, sahifani yopib yuboradi va generatsiya bekorga
 * ketadi. Shuning uchun kutish vaqti OLDINDAN, forma ustida aytiladi.
 */

/** Bosqichli xabarlarning TARJIMA KALITLARI. */
const PROGRESS_KEYS = [
  "progress.sent",
  "progress.sequence",
  "progress.distribute",
  "progress.hours",
  "progress.file",
  "progress.finishing",
] as const;

export default function NewCalendarPlanPage() {
  const router = useRouter();
  const t = useTranslations("calendarPlans");
  const tRoot = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Davr tanlanganda haftalar soni avtomatik to'ldiriladi.
  const [weeks, setWeeks] = useState<number>(PERIOD_PRESETS[0].weeks);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setProgressIndex(0);
    setElapsed(0);

    const ticker = setInterval(() => {
      setProgressIndex((current) => Math.min(current + 1, PROGRESS_KEYS.length - 1));
    }, 8000);
    // O'tgan vaqtni ko'rsatamiz — uzoq kutishda "ishlayaptimi?" degan
    // savol tug'ilmasin.
    const clock = setInterval(() => setElapsed((value) => value + 1), 1000);

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const created = await apiRequest<{ calendarPlan: { id: string } }>(
        "/api/calendar-plans",
        { method: "POST", body },
      );
      router.replace(`/dashboard/calendar-plans/${created.calendarPlan.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        else setFormError(error.message);
      } else {
        setFormError(tRoot("common.unexpectedError"));
      }
      setSubmitting(false);
    } finally {
      clearInterval(ticker);
      clearInterval(clock);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard/calendar-plans"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← {tRoot("common.back")}
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-slate-900">{t("new.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("new.subtitle")}</p>

      {/* Kutish vaqti OLDINDAN aytiladi — yuborgandan keyin emas. */}
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        <span className="font-medium">{t("new.slowWarningLabel")}</span>{" "}
        {t("new.slowWarning")}
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      >
        {formError !== null && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={tRoot("lessonPlans.fields.subject")}
            name="subject"
            placeholder={tRoot("lessonPlans.fields.subjectPlaceholder")}
            errors={fieldErrors}
            disabled={submitting}
          />
          <TextField
            label={tRoot("lessonPlans.fields.grade")}
            name="grade"
            placeholder={tRoot("lessonPlans.fields.gradePlaceholder")}
            errors={fieldErrors}
            disabled={submitting}
          />
        </div>

        <div>
          <label
            htmlFor="period"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            {t("fields.period")}
          </label>
          <select
            id="period"
            name="period"
            defaultValue={PERIOD_PRESETS[0].key}
            disabled={submitting}
            onChange={(event) => {
              const preset = PERIOD_PRESETS.find(
                (item) => item.key === event.target.value,
              );
              if (preset) setWeeks(preset.weeks);
            }}
            className={selectClasses(fieldErrors.period !== undefined)}
          >
            {PERIOD_PRESETS.map((preset) => (
              <option key={preset.key} value={t(`periods.${preset.key}`)}>
                {t("fields.periodOption", {
                  label: t(`periods.${preset.key}`),
                  weeks: preset.weeks,
                })}
              </option>
            ))}
          </select>
          {fieldErrors.period !== undefined && (
            <p className="mt-1.5 text-xs text-red-600">{fieldErrors.period.join(" ")}</p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="startDate"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t("fields.startDate")}
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={toDateInputValue(new Date())}
              disabled={submitting}
              aria-invalid={fieldErrors.startDate !== undefined}
              className={selectClasses(fieldErrors.startDate !== undefined)}
            />
            {fieldErrors.startDate !== undefined && (
              <p className="mt-1.5 text-xs text-red-600">
                {fieldErrors.startDate.join(" ")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="weeks"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t("fields.weeks")}
            </label>
            <input
              id="weeks"
              name="weeks"
              type="number"
              min={1}
              max={52}
              required
              value={weeks}
              onChange={(event) => setWeeks(Number(event.target.value))}
              disabled={submitting}
              aria-invalid={fieldErrors.weeks !== undefined}
              className={selectClasses(fieldErrors.weeks !== undefined)}
            />
            {fieldErrors.weeks !== undefined && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.weeks.join(" ")}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="hoursPerWeek"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t("fields.hoursPerWeek")}
            </label>
            <select
              id="hoursPerWeek"
              name="hoursPerWeek"
              defaultValue="2"
              disabled={submitting}
              className={selectClasses(fieldErrors.hoursPerWeek !== undefined)}
            >
              {HOURS_PER_WEEK_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {t("fields.hoursOption", { hours })}
                </option>
              ))}
            </select>
            {fieldErrors.hoursPerWeek !== undefined && (
              <p className="mt-1.5 text-xs text-red-600">
                {fieldErrors.hoursPerWeek.join(" ")}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="language"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            {tRoot("common.language")}
          </label>
          <select
            id="language"
            name="language"
            defaultValue="UZ"
            disabled={submitting}
            className={selectClasses(false)}
          >
            {/* GENERATSIYA tili — interfeys tilidan mustaqil. */}
            {GENERATION_LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {tRoot(`languages.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? tRoot("common.creating") : t("new.submit")}
        </button>

        {submitting && (
          <div
            aria-live="polite"
            className="rounded-lg bg-slate-50 px-3 py-3 text-center"
          >
            <p className="text-sm text-slate-700">{t(PROGRESS_KEYS[progressIndex])}</p>
            <p className="mt-1 text-xs text-slate-400">
              {t("detail.elapsed", { seconds: elapsed })}
            </p>
            {/* Ayniqsa uzoq cho'zilsa qo'shimcha tinchlantirish. */}
            {elapsed > 45 && (
              <p className="mt-1.5 text-xs text-amber-700">
                Uzun davr uchun biroz ko&apos;proq vaqt ketmoqda — jarayon hali davom
                etyapti.
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function selectClasses(hasError: boolean): string {
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
}: {
  label: string;
  name: string;
  placeholder?: string;
  errors: Record<string, string[]>;
  disabled?: boolean;
}) {
  const fieldErrors = errors[name];
  const hasError = fieldErrors !== undefined && fieldErrors.length > 0;

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        required
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : undefined}
        className={selectClasses(hasError)}
      />
      {hasError && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600">
          {fieldErrors.join(" ")}
        </p>
      )}
    </div>
  );
}
