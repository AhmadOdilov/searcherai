"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { GENERATION_LANGUAGES } from "@/lib/ui/options";
import { MAX_WEEKS } from "@/lib/validations/calendar-plan";
import {
  HOURS_PER_WEEK_OPTIONS,
  PERIOD_PRESETS,
  toDateInputValue,
} from "@/lib/calendar-plans/labels";
import { BackLink } from "@/components/ui/back-link";
import { Card, FormSection, PageHeader, ToneCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError, Input, Select } from "@/components/ui/field";
import { HelpLink } from "@/components/ui/help-link";

/**
 * `/dashboard/calendar-plans/new` — kalendar reja yaratish formasi.
 *
 * ── Nega kutish ogohlantirishi boshqalardan kuchliroq ─────────────────────
 * Bu modul eng sekin: 30-70 qatorli javob 60-90 soniya olishi mumkin
 * (boshqa modullarda 5-15 soniya). Foydalanuvchi bu qadar uzoq kutishga
 * TAYYORLANMAGAN bo'lsa, sahifani yopib yuboradi. Shuning uchun kutish
 * vaqti OLDINDAN, forma ustida, alohida rangli blokda aytiladi.
 */

export default function NewCalendarPlanPage() {
  const router = useRouter();
  const t = useTranslations("calendarPlans");
  const tRoot = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Davr tanlanganda haftalar soni avtomatik to'ldiriladi.
  const [weeks, setWeeks] = useState<number>(PERIOD_PRESETS[0].weeks);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

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
    }
  }

  const tooManyWeeks = weeks > MAX_WEEKS;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard/calendar-plans" />

      <div className="mt-4">
        <PageHeader title={t("new.title")} description={t("new.subtitle")} />
      </div>

      <ToneCard tone="accent" className="mt-6" padding="sm">
        <div className="flex gap-3">
          <Clock aria-hidden className="mt-0.5 size-6 shrink-0 text-accent" />
          <p className="text-base leading-relaxed text-accent-ink">
            <span className="font-semibold">{t("new.slowWarningLabel")}</span>{" "}
            {t("new.slowWarning")}
          </p>
        </div>
      </ToneCard>

      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {formError !== null && <FormError message={formError} />}

          <FormSection step={1} title={t("new.sectionSubject")}>
            <Input
              label={tRoot("lessonPlans.fields.subject")}
              name="subject"
              required
              placeholder={tRoot("lessonPlans.fields.subjectPlaceholder")}
              hint={tRoot("lessonPlans.fields.subjectHint")}
              help={tRoot("lessonPlans.fields.subjectHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <Input
              label={tRoot("lessonPlans.fields.grade")}
              name="grade"
              required
              placeholder={tRoot("lessonPlans.fields.gradePlaceholder")}
              hint={tRoot("lessonPlans.fields.gradeHint")}
              help={tRoot("lessonPlans.fields.gradeHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
          </FormSection>

          <FormSection step={2} title={t("new.sectionPeriod")}>
            <Select
              label={t("fields.period")}
              name="period"
              defaultValue={t(`periods.${PERIOD_PRESETS[0].key}`)}
              disabled={submitting}
              errors={fieldErrors}
              help={t("fields.periodHelp")}
              onChange={(event) => {
                const preset = PERIOD_PRESETS.find(
                  (item) => t(`periods.${item.key}`) === event.target.value,
                );
                if (preset) setWeeks(preset.weeks);
              }}
              options={PERIOD_PRESETS.map((preset) => ({
                value: t(`periods.${preset.key}`),
                label: t("fields.periodOption", {
                  label: t(`periods.${preset.key}`),
                  weeks: preset.weeks,
                }),
              }))}
            />

            <Input
              label={t("fields.startDate")}
              name="startDate"
              type="date"
              required
              defaultValue={toDateInputValue(new Date())}
              disabled={submitting}
              help={t("fields.startDateHelp")}
              errors={fieldErrors}
            />

            <Input
              label={t("fields.weeks")}
              name="weeks"
              type="number"
              min={1}
              max={MAX_WEEKS}
              required
              value={weeks}
              onChange={(event) => setWeeks(Number(event.target.value))}
              disabled={submitting}
              help={t("fields.weeksHelp")}
              /*
                Chegara MODEL imkoniyatidan kelib chiqadi: 24 haftadan
                uzun rejani AI ishonchli tuza olmaydi (haqiqiy o'lchov).
                Foydalanuvchi buni OLDINDAN bilishi kerak — forma
                yuborilib, natija yiqilgandan keyin emas.
              */
              hint={tooManyWeeks ? undefined : t("fields.weeksHint")}
              errors={
                tooManyWeeks
                  ? { ...fieldErrors, weeks: [t("fields.maxWeeksNotice")] }
                  : fieldErrors
              }
            />

            <Select
              label={t("fields.hoursPerWeek")}
              name="hoursPerWeek"
              defaultValue="2"
              disabled={submitting}
              help={t("fields.hoursPerWeekHelp")}
              errors={fieldErrors}
              options={HOURS_PER_WEEK_OPTIONS.map((hours) => ({
                value: String(hours),
                label: t("fields.hoursOption", { hours }),
              }))}
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

          <div>
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={tooManyWeeks}
            >
              {submitting ? tRoot("common.creating") : t("new.submit")}
            </Button>
            <p className="mt-3 text-center text-base text-neutral-600">
              {t("new.timeNotice")}
            </p>
          </div>
        </form>
      </Card>

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
