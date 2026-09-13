"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Lightbulb, ListChecks, Search, Sparkles } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { GENERATION_LANGUAGES } from "@/lib/ui/options";
import { Card, FormSection, ToneCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import type { SearchAnswer } from "@/lib/validations/search";

/**
 * AI qidiruv — savol berish va javobni ko'rsatish.
 *
 * ── Nega bitta klient komponenti ──────────────────────────────────────────
 * Forma va javob BIR EKRANDA turadi: o'qituvchi savolni o'zgartirib,
 * darhol yangi javob oladi. Ular alohida sahifa bo'lsa, har savolda
 * orqaga-oldinga yurish kerak bo'lardi.
 *
 * ── Kutish rejimi ─────────────────────────────────────────────────────────
 * Bu modul boshqalaridan tez (5-10 soniya), shuning uchun bu yerda
 * `GenerationProgress` (bosqichli matn, progress chizig'i) ishlatilmaydi —
 * u 60-90 soniyalik kutish uchun yasalgan. Bu yerda tugmaning o'zidagi
 * aylanuvchi belgi va bitta tinchlantiruvchi jumla yetarli.
 *
 * ── Uslub ─────────────────────────────────────────────────────────────────
 * Bu faylda birorta ham yangi rang yoki o'lcham yozilmagan: hamma narsa
 * `Card`, `ToneCard`, `Button`, `Input`, `Textarea`, `Select`,
 * `EmptyState` va dizayn tokenlaridan keladi.
 */

interface SearchResponse {
  answer: SearchAnswer;
}

export function SearchPanel() {
  const t = useTranslations("search");
  const tRoot = useTranslations();

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  /** Javob qaysi savolga berilganini ko'rsatish uchun. */
  const [askedQuestion, setAskedQuestion] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const question = String(formData.get("question") ?? "");

    // Bo'sh ixtiyoriy maydonlar yuborilmaydi: sxemada ular `optional`,
    // bo'sh satr esa "juda qisqa" xatosiga tushardi.
    const body: Record<string, unknown> = {
      question,
      language: formData.get("language"),
    };
    const subject = String(formData.get("subject") ?? "").trim();
    const grade = String(formData.get("grade") ?? "").trim();
    if (subject !== "") body.subject = subject;
    if (grade !== "") body.grade = grade;

    try {
      const result = await apiRequest<SearchResponse>("/api/search", {
        method: "POST",
        body,
      });
      setAnswer(result.answer);
      setAskedQuestion(question);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) setFieldErrors(error.fieldErrors);
        else setFormError(error.message);
      } else {
        setFormError(tRoot("common.unexpectedError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          {formError !== null && <FormError message={formError} />}

          <FormSection step={1} title={t("sectionQuestion")}>
            <Textarea
              label={t("fields.question")}
              name="question"
              required
              rows={3}
              placeholder={t("fields.questionPlaceholder")}
              hint={t("fields.questionHint")}
              help={t("fields.questionHelp")}
              errors={fieldErrors}
              disabled={loading}
            />
          </FormSection>

          <FormSection
            step={2}
            title={t("sectionContext")}
            description={t("contextHint")}
          >
            <Input
              label={tRoot("lessonPlans.fields.subject")}
              name="subject"
              placeholder={tRoot("lessonPlans.fields.subjectPlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={loading}
            />
            <Input
              label={tRoot("lessonPlans.fields.grade")}
              name="grade"
              placeholder={tRoot("lessonPlans.fields.gradePlaceholder")}
              hint={tRoot("common.optional")}
              errors={fieldErrors}
              disabled={loading}
            />
            <Select
              label={tRoot("common.contentLanguage")}
              name="language"
              defaultValue="UZ"
              help={tRoot("common.contentLanguageHelp")}
              errors={fieldErrors}
              disabled={loading}
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
              loading={loading}
              icon={loading ? undefined : <Search aria-hidden className="size-5" />}
            >
              {loading ? t("asking") : t("submit")}
            </Button>
            <p className="mt-3 text-center text-base text-neutral-600">
              {loading ? tRoot("common.almostReady") : t("timeNotice")}
            </p>
          </div>
        </form>
      </Card>

      {answer === null ? (
        !loading && (
          <EmptyState
            icon={<Sparkles aria-hidden className="size-9" />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <ul className="w-full max-w-md space-y-2 text-left">
                {EXAMPLE_KEYS.map((key) => (
                  <li
                    key={key}
                    className="rounded-md bg-neutral-100 px-4 py-3 text-base text-neutral-700"
                  >
                    {t(`examples.${key}`)}
                  </li>
                ))}
              </ul>
            }
          />
        )
      ) : (
        <AnswerView answer={answer} question={askedQuestion} />
      )}
    </>
  );
}

/** Bo'sh ekrandagi namuna savollar — nimadan boshlashni ko'rsatadi. */
const EXAMPLE_KEYS = ["first", "second", "third"] as const;

function AnswerView({ answer, question }: { answer: SearchAnswer; question: string }) {
  const t = useTranslations("search");

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold text-neutral-900">{t("answerTitle")}</h2>
      <p className="mt-2 text-base leading-relaxed text-neutral-600">
        {t("answerFor", { question })}
      </p>

      {/* ── Asosiy javob ────────────────────────────────────────────────── */}
      <ToneCard tone="primary" className="mt-4">
        <p className="text-lg leading-relaxed text-primary-ink">{answer.answer}</p>
      </ToneCard>

      {/* ── Asosiy nuqtalar ─────────────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <ListChecks className="size-6" />
          </span>
          <h3 className="text-xl font-semibold text-neutral-900">{t("keyPoints")}</h3>
        </div>

        <ul className="mt-4 space-y-2">
          {answer.keyPoints.map((point, index) => (
            <li key={index} className="flex gap-3 text-base text-neutral-700">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── Sinfda qanday ishlatish ─────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <Lightbulb className="size-6" />
          </span>
          <h3 className="text-xl font-semibold text-neutral-900">
            {t("classroomIdeas")}
          </h3>
        </div>

        <ol className="mt-4 space-y-3">
          {answer.classroomIdeas.map((idea, index) => (
            <li key={index} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-on-primary"
              >
                {index + 1}
              </span>
              <span className="pt-1 text-base leading-relaxed text-neutral-700">
                {idea}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* ── Ehtiyot bo'ling ─────────────────────────────────────────────── */}
      {answer.caution !== undefined && (
        <ToneCard tone="accent" className="mt-4">
          <div className="flex gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-6 shrink-0 text-accent" />
            <div>
              <p className="text-lg font-semibold text-accent-ink">{t("caution")}</p>
              <p className="mt-2 text-base leading-relaxed text-accent-ink">
                {answer.caution}
              </p>
            </div>
          </div>
        </ToneCard>
      )}
    </section>
  );
}
