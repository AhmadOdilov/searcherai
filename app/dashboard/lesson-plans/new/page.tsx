"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { DURATION_OPTIONS } from "@/lib/lesson-plans/labels";
import { LESSON_TYPES, GENERATION_LANGUAGES } from "@/lib/ui/options";
import { BackLink } from "@/components/ui/back-link";
import { Card, FormSection, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError, Input, Select } from "@/components/ui/field";
import { HelpLink } from "@/components/ui/help-link";
import { ToneCard } from "@/components/ui/card";
import { takeVisionHandoff, type VisionHandoff } from "@/lib/vision/handoff";
import { ImageIcon } from "lucide-react";

/**
 * `/dashboard/lesson-plans/new` — dars ishlanmasi yaratish formasi.
 *
 * ── Forma ikki bo'limga ajratilgan ────────────────────────────────────────
 * 1-bo'lim: dars NIMA haqida (fan, sinf, mavzu).
 * 2-bo'lim: dars QANDAY o'tadi (davomiylik, turi, tili).
 *
 * Ajratish shuning uchun: oltita maydon ketma-ket turganda ular bir
 * xil muhimlikda ko'rinadi va foydalanuvchi "bularning hammasini
 * bilishim kerakmi?" degan hisga tushadi. Bo'limlar bu yukni
 * ikkiga bo'ladi.
 *
 * Yuborilgach natija sahifasiga o'tiladi — kutish AYNAN u yerda
 * ko'rsatiladi (`GenerationProgress`), chunki manzil darhol almashsa
 * foydalanuvchi sahifani yopib-ochsa ham ishi yo'qolmaydi.
 */

interface CreatedPlan {
  lessonPlan: { id: string };
}

/**
 * Rasm tahlilini BIR MARTA o'qiydi.
 *
 * `useSyncExternalStore` bilan: `sessionStorage` serverda yo'q, ya'ni
 * server HTML'i va brauzerdagi birinchi render mos kelmasligi mumkin.
 * `useEffect` + `setState` esa ortiqcha render zanjirini keltirardi
 * (`Onboarding` komponentida ham shu yondashuv).
 */
const emptyHandoff: VisionHandoff | null = null;
let cachedHandoff: VisionHandoff | null | undefined;

function subscribeHandoff(): () => void {
  return () => undefined;
}

function readHandoff(): VisionHandoff | null {
  // Natija keshlanadi: `useSyncExternalStore` `getSnapshot` ni bir necha
  // marta chaqiradi, `takeVisionHandoff()` esa o'qigach O'CHIRADI —
  // keshsiz ikkinchi chaqiruvda `null` qaytib, ma'lumot yo'qolardi.
  if (cachedHandoff === undefined) cachedHandoff = takeVisionHandoff();
  return cachedHandoff;
}

function readHandoffOnServer(): VisionHandoff | null {
  return emptyHandoff;
}

export default function NewLessonPlanPage() {
  const router = useRouter();
  const t = useTranslations("lessonPlans");
  const tRoot = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /** Rasmdan kelgan ma'lumot — bo'lsa, forma oldindan to'ldiriladi. */
  const handoff = useSyncExternalStore(
    subscribeHandoff,
    readHandoff,
    readHandoffOnServer,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(formData.entries());

    // Rasmdan o'qilgan matn — formada ko'rinmaydi, lekin promptga ketadi.
    if (handoff !== null) {
      body.sourceMaterial = handoff.sourceMaterial;
    }

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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard/lesson-plans" />

      <div className="mt-4">
        <PageHeader title={t("new.title")} description={t("new.subtitle")} />
      </div>

      {/*
        Rasmdan kelingan bo'lsa — buni AYTAMIZ. Aks holda o'qituvchi
        maydonlar o'zidan to'lganini ko'rib, ilova nimadir "o'ylab
        topgan" deb o'ylardi.
      */}
      {handoff !== null && (
        <ToneCard tone="primary" className="mt-6" padding="sm">
          <div className="flex gap-3">
            <ImageIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-primary" />
            <div>
              <p className="text-base font-semibold text-primary-ink">
                {t("new.fromImageTitle")}
              </p>
              <p className="mt-1 text-base leading-relaxed text-primary-ink">
                {t("new.fromImageHint")}
              </p>
            </div>
          </div>
        </ToneCard>
      )}

      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {formError !== null && <FormError message={formError} />}

          <FormSection step={1} title={t("new.sectionAbout")}>
            <Input
              label={t("fields.subject")}
              name="subject"
              required
              defaultValue={handoff?.subject}
              placeholder={t("fields.subjectPlaceholder")}
              hint={t("fields.subjectHint")}
              help={t("fields.subjectHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <Input
              label={t("fields.grade")}
              name="grade"
              required
              defaultValue={handoff?.grade}
              placeholder={t("fields.gradePlaceholder")}
              hint={t("fields.gradeHint")}
              help={t("fields.gradeHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <Input
              label={t("fields.topic")}
              name="topic"
              required
              defaultValue={handoff?.topic}
              placeholder={t("fields.topicPlaceholder")}
              hint={t("fields.topicHint")}
              help={t("fields.topicHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
          </FormSection>

          <FormSection step={2} title={t("new.sectionHow")}>
            <Select
              label={t("fields.duration")}
              name="durationMinutes"
              defaultValue="45"
              options={DURATION_OPTIONS.map((minutes) => ({
                value: String(minutes),
                label: t("fields.durationOption", { minutes }),
              }))}
              help={t("fields.durationHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
            <Select
              label={t("fields.lessonType")}
              name="lessonType"
              defaultValue="NEW_TOPIC"
              options={LESSON_TYPES.map((value) => ({
                value,
                // Tanlovlar ro'yxatning ICHIDA ham tushuntiriladi:
                // "Yangi mavzu — birinchi marta tushuntiriladigan dars".
                label: t(`typeOptions.${value}`),
              }))}
              help={t("fields.lessonTypeHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
            {/*
              DIQQAT: bu GENERATSIYA tili — dars ishlanmasi qaysi tilda
              yoziladi. Interfeys tilidan MUSTAQIL: o'qituvchi interfeysni
              ruscha ishlatib, darsni o'zbekcha so'rashi mumkin.
            */}
            <Select
              label={tRoot("common.contentLanguage")}
              name="language"
              defaultValue="UZ"
              options={GENERATION_LANGUAGES.map((value) => ({
                value,
                label: tRoot(`languages.${value}`),
              }))}
              help={tRoot("common.contentLanguageHelp")}
              errors={fieldErrors}
              disabled={submitting}
            />
          </FormSection>

          <div>
            <Button type="submit" size="lg" fullWidth loading={submitting}>
              {submitting ? tRoot("common.creating") : t("new.submit")}
            </Button>
            {/* Kutish vaqti OLDINDAN aytiladi — yuborgandan keyin emas. */}
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
