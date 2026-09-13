"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, Sparkles } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { GENERATION_LANGUAGES } from "@/lib/ui/options";
import { Card, FormSection } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/ui/cn";

/**
 * Prezentatsiya yaratish formasi.
 *
 * Ikki rejim bir formada: rejim tanlanganda faqat KERAKLI maydonlar
 * ko'rsatiladi. Backenddagi `discriminatedUnion` sxemasi ham xuddi shu
 * mantiqni takrorlaydi — ikkisi bir-biriga mos.
 *
 * ── Rejim tanlash katta kartalar bilan ────────────────────────────────────
 * Ilgari bu ikki kichik tugma edi va tanlangani faqat ingichka chiziq
 * bilan ajralib turardi. Endi kartalar katta, belgili, tanlangani esa
 * to'ldirilgan fon bilan ko'rinadi — "qaysi biri tanlangan?" degan
 * savol tug'ilmaydi.
 */

export interface LessonPlanOption {
  id: string;
  topic: string;
  subject: string;
  grade: string;
}

type Mode = "from-lesson-plan" | "standalone";

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
  // ro'yxat ko'rsatishdan ko'ra shunisi tushunarli.
  const [mode, setMode] = useState<Mode>(
    lessonPlans.length > 0 ? "from-lesson-plan" : "standalone",
  );
  const [lessonPlanId, setLessonPlanId] = useState<string>(
    preselectedLessonPlanId ?? lessonPlans[0]?.id ?? "",
  );

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

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
    }
  }

  return (
    <Card className="mt-6">
      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        {formError !== null && <FormError message={formError} />}

        {/* ── Rejim tanlash ────────────────────────────────────────────── */}
        <FormSection step={1} title={t("new.modeQuestion")}>
          <fieldset disabled={submitting}>
            <legend className="sr-only">{t("new.modeQuestion")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeOption
                value="from-lesson-plan"
                current={mode}
                onSelect={setMode}
                icon={<BookOpen aria-hidden className="size-6" />}
                title={t("new.modeFromPlan")}
                description={t("new.modeFromPlanHint")}
                disabled={lessonPlans.length === 0}
                disabledHint={t("new.modeFromPlanDisabled")}
              />
              <ModeOption
                value="standalone"
                current={mode}
                onSelect={setMode}
                icon={<Sparkles aria-hidden className="size-6" />}
                title={t("new.modeStandalone")}
                description={t("new.modeStandaloneHint")}
              />
            </div>
          </fieldset>

          {mode === "from-lesson-plan" && lessonPlans.length === 0 && (
            <p className="text-base leading-relaxed text-neutral-600">
              {t("new.noPlansPrefix")}{" "}
              <Link
                href="/dashboard/lesson-plans/new"
                className="font-medium text-primary underline underline-offset-4"
              >
                {t("new.noPlansLink")}
              </Link>{" "}
              {t("new.noPlansSuffix")}
            </p>
          )}
        </FormSection>

        {/* ── Rejimga qarab maydonlar ──────────────────────────────────── */}
        {mode === "from-lesson-plan" ? (
          <FormSection step={2} title={t("new.sectionChoosePlan")}>
            <Select
              label={t("new.lessonPlanField")}
              name="lessonPlanId"
              value={lessonPlanId}
              onChange={(event) => setLessonPlanId(event.target.value)}
              disabled={submitting}
              hint={t("new.lessonPlanHint")}
              help={t("new.lessonPlanHelp")}
              errors={fieldErrors}
              options={lessonPlans.map((plan) => ({
                value: plan.id,
                label: `${plan.topic} — ${plan.subject}, ${plan.grade}`,
              }))}
            />
          </FormSection>
        ) : (
          <FormSection step={2} title={t("new.sectionTopic")}>
            <Input
              label={tRoot("lessonPlans.fields.topic")}
              name="topic"
              required
              placeholder={t("new.topicPlaceholder")}
              hint={tRoot("lessonPlans.fields.topicHint")}
              help={tRoot("lessonPlans.fields.topicHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <Input
              label={tRoot("lessonPlans.fields.subject")}
              name="subject"
              placeholder={t("new.subjectPlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <Input
              label={tRoot("lessonPlans.fields.grade")}
              name="grade"
              placeholder={t("new.gradePlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={submitting}
            />
            {/* GENERATSIYA tili — interfeys tilidan mustaqil. */}
            <Select
              label={tRoot("common.contentLanguage")}
              name="language"
              defaultValue="UZ"
              disabled={submitting}
              help={tRoot("common.contentLanguageHelp")}
              errors={fieldErrors}
              options={GENERATION_LANGUAGES.map((value) => ({
                value,
                label: tRoot(`languages.${value}`),
              }))}
            />
          </FormSection>
        )}

        <div>
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={mode === "from-lesson-plan" && lessonPlanId === ""}
          >
            {submitting ? tRoot("common.creating") : t("new.submit")}
          </Button>
          <p className="mt-3 text-center text-base text-neutral-600">
            {t("new.timeNotice")}
          </p>
        </div>
      </form>
    </Card>
  );
}

// ─── Kichik komponentlar ─────────────────────────────────────────────────────

function ModeOption({
  value,
  current,
  onSelect,
  icon,
  title,
  description,
  disabled = false,
  disabledHint,
}: {
  value: Mode;
  current: Mode;
  onSelect: (mode: Mode) => void;
  icon: React.ReactNode;
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
      className={cn(
        "flex min-h-11 flex-col rounded-lg border p-4 text-left transition-all duration-150",
        "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary bg-primary-soft ring-2 ring-primary"
          : "border-neutral-300 bg-surface hover:border-primary-border hover:bg-neutral-50",
      )}
    >
      <span className={selected ? "text-primary" : "text-neutral-400"}>{icon}</span>
      <span className="mt-2 block text-lg font-semibold text-neutral-900">{title}</span>
      <span className="mt-1 block text-base leading-relaxed text-neutral-600">
        {disabled && disabledHint !== undefined ? disabledHint : description}
      </span>
    </button>
  );
}
