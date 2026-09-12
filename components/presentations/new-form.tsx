"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { GENERATION_LANGUAGES } from "@/lib/ui/options";

/**
 * Prezentatsiya yaratish formasi.
 *
 * Ikki rejim bir formada: rejim tanlanganda faqat KERAKLI maydonlar
 * ko'rsatiladi. Backenddagi `discriminatedUnion` sxemasi ham xuddi shu
 * mantiqni takrorlaydi — ikkisi bir-biriga mos.
 */

export interface LessonPlanOption {
  id: string;
  topic: string;
  subject: string;
  grade: string;
}

type Mode = "from-lesson-plan" | "standalone";

/** Bosqichli xabarlarning TARJIMA KALITLARI. */
const PROGRESS_KEYS = [
  "progress.sent",
  "progress.slides",
  "progress.bullets",
  "progress.file",
  "progress.finishing",
] as const;

export function NewPresentationForm({
  lessonPlans,
  preselectedLessonPlanId,
}: {
  lessonPlans: LessonPlanOption[];
  preselectedLessonPlanId: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("presentations");
  const tRoot = useTranslations();

  // Dars ishlanmasi bo'lmasa mustaqil rejimdan boshlaymiz — bo'sh
  // dropdown ko'rsatishdan ko'ra shunisi tushunarli.
  const [mode, setMode] = useState<Mode>(
    lessonPlans.length > 0 ? "from-lesson-plan" : "standalone",
  );
  const [lessonPlanId, setLessonPlanId] = useState<string>(
    preselectedLessonPlanId ?? lessonPlans[0]?.id ?? "",
  );

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

    const ticker = setInterval(() => {
      setProgressIndex((current) => Math.min(current + 1, PROGRESS_KEYS.length - 1));
    }, 4000);

    const formData = new FormData(event.currentTarget);

    // So'rov tanasi rejimga qarab BOSHQACHA — backenddagi
    // `discriminatedUnion` shu shaklni kutadi.
    const body =
      mode === "from-lesson-plan"
        ? { mode, lessonPlanId }
        : {
            mode,
            topic: formData.get("topic"),
            // Bo'sh maydonlar yuborilmaydi: sxemada ular ixtiyoriy, bo'sh
            // satr esa "juda qisqa" degan xatoga olib kelardi.
            ...(formData.get("subject") ? { subject: formData.get("subject") } : {}),
            ...(formData.get("grade") ? { grade: formData.get("grade") } : {}),
            language: formData.get("language"),
          };

    try {
      const created = await apiRequest<{ presentation: { id: string } }>(
        "/api/presentations",
        { method: "POST", body },
      );
      router.replace(`/dashboard/presentations/${created.presentation.id}`);
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
    }
  }

  return (
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

      {/* ── Rejim tanlash ──────────────────────────────────────────────── */}
      <fieldset disabled={submitting}>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          {t("new.modeQuestion")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeOption
            value="from-lesson-plan"
            current={mode}
            onSelect={setMode}
            title={t("new.modeFromPlan")}
            description={t("new.modeFromPlanHint")}
            disabled={lessonPlans.length === 0}
            disabledHint={t("new.modeFromPlanDisabled")}
          />
          <ModeOption
            value="standalone"
            current={mode}
            onSelect={setMode}
            title={t("new.modeStandalone")}
            description={t("new.modeStandaloneHint")}
          />
        </div>
      </fieldset>

      {/* ── Rejimga qarab maydonlar ────────────────────────────────────── */}
      {mode === "from-lesson-plan" ? (
        <div>
          <label
            htmlFor="lessonPlanId"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            {t("new.lessonPlanField")}
          </label>
          <select
            id="lessonPlanId"
            value={lessonPlanId}
            onChange={(event) => setLessonPlanId(event.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
          >
            {lessonPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.topic} — {plan.subject}, {plan.grade}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-400">{t("new.lessonPlanHint")}</p>
          {fieldErrors.lessonPlanId !== undefined && (
            <p className="mt-1.5 text-xs text-red-600">
              {fieldErrors.lessonPlanId.join(" ")}
            </p>
          )}
        </div>
      ) : (
        <>
          <TextField
            label={tRoot("lessonPlans.fields.topic")}
            name="topic"
            placeholder={t("new.topicPlaceholder")}
            required
            errors={fieldErrors}
            disabled={submitting}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField
              label={tRoot("lessonPlans.fields.subject")}
              name="subject"
              placeholder={t("new.subjectPlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <TextField
              label={tRoot("lessonPlans.fields.grade")}
              name="grade"
              placeholder={t("new.gradePlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={submitting}
            />
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                {/*
                  GENERATSIYA tili — interfeys tilidan mustaqil.
                */}
                {GENERATION_LANGUAGES.map((value) => (
                  <option key={value} value={value}>
                    {tRoot(`languages.${value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={submitting || (mode === "from-lesson-plan" && lessonPlanId === "")}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? tRoot("common.creating") : t("new.submit")}
      </button>

      {submitting && (
        <div aria-live="polite" className="rounded-lg bg-slate-50 px-3 py-3 text-center">
          <p className="text-sm text-slate-700">{t(PROGRESS_KEYS[progressIndex])}</p>
          <p className="mt-1 text-xs text-slate-400">
            Bu 30 soniyagacha davom etishi mumkin — sahifani yopmang.
          </p>
        </div>
      )}

      {mode === "from-lesson-plan" && lessonPlans.length === 0 && (
        <p className="text-xs text-slate-500">
          {t("new.noPlansPrefix")}{" "}
          <Link
            href="/dashboard/lesson-plans/new"
            className="font-medium text-slate-900 underline"
          >
            {t("new.noPlansLink")}
          </Link>{" "}
          {t("new.noPlansSuffix")}
        </p>
      )}
    </form>
  );
}

// ─── Kichik komponentlar ─────────────────────────────────────────────────────

function ModeOption({
  value,
  current,
  onSelect,
  title,
  description,
  disabled = false,
  disabledHint,
}: {
  value: Mode;
  current: Mode;
  onSelect: (mode: Mode) => void;
  title: string;
  description: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const selected = current === value;

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span className="block text-sm font-medium text-slate-900">{title}</span>
      <span className="mt-0.5 block text-xs text-slate-500">
        {disabled && disabledHint !== undefined ? disabledHint : description}
      </span>
    </button>
  );
}

function TextField({
  label,
  name,
  placeholder,
  hint,
  required = false,
  errors,
  disabled,
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
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
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 disabled:bg-slate-50 ${
          hasError
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-300 focus:border-slate-400 focus:ring-slate-100"
        }`}
      />
      {hasError ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-600">
          {fieldErrors.join(" ")}
        </p>
      ) : hint !== undefined ? (
        <p id={`${name}-hint`} className="mt-1.5 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
