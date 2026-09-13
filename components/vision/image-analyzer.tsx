"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Camera, ImagePlus, ListChecks, Sparkles, X } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { Card, ToneCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/ui/cn";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type VisionAnalysis,
} from "@/lib/validations/vision";
import { VISION_HANDOFF_KEY, type VisionHandoff } from "@/lib/vision/handoff";

/**
 * Rasm yuklash va tahlil qilish paneli.
 *
 * ── Mobil birinchi ────────────────────────────────────────────────────────
 * Asosiy stsenariy: o'qituvchi darslik sahifasini TELEFONDA suratga oladi.
 * Shuning uchun ikkita alohida tugma bor:
 *  · "Suratga olish" — `capture="environment"` bilan, telefonda orqa
 *    kamerani darhol ochadi (galereyaga kirmasdan);
 *  · "Fayl tanlash" — kompyuterda va galereyadan tanlash uchun.
 *
 * Bitta tugma qilish mumkin edi, lekin unda telefon "kamera yoki
 * galereya?" degan qo'shimcha savol beradi — bu ortiqcha qadam.
 *
 * ── Tekshiruv IKKI joyda ──────────────────────────────────────────────────
 * Bu yerdagi tekshiruv — QULAYLIK uchun: 8 MB faylni yuklab, keyin
 * serverdan xato olishdan ko'ra darhol aytgan yaxshi. Haqiqiy himoya
 * serverda (`lib/vision/service.ts`), u fayl baytlarini ham tekshiradi.
 */

interface VisionResponse {
  analysis: VisionAnalysis;
}

export function ImageAnalyzer() {
  const t = useTranslations("vision");
  const tRoot = useTranslations();
  const router = useRouter();

  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);

  function reset() {
    setPreview(null);
    setFileName("");
    setAnalysis(null);
    setFormError(null);
    setFieldErrors({});
  }

  function acceptFile(file: File | undefined) {
    if (file === undefined) return;

    setAnalysis(null);
    setFormError(null);
    setFieldErrors({});

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
      setFormError(t("errors.wrongFormat"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError(t("errors.tooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(typeof reader.result === "string" ? reader.result : null);
      setFileName(file.name);
    };
    reader.onerror = () => setFormError(t("errors.notReadable"));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview === null) return;

    setLoading(true);
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { image: preview, language: "UZ" };
    const subject = String(formData.get("subject") ?? "").trim();
    const grade = String(formData.get("grade") ?? "").trim();
    if (subject !== "") body.subject = subject;
    if (grade !== "") body.grade = grade;

    try {
      const result = await apiRequest<VisionResponse>("/api/vision-analyze", {
        method: "POST",
        body,
      });
      setAnalysis(result.analysis);
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

  /**
   * Tahlilni dars ishlanmasi formasiga uzatadi.
   *
   * ── Nega `sessionStorage`, manzil parametri emas ─────────────────────────
   * Rasmdan o'qilgan matn 1-2 ming belgi bo'lishi mumkin. Uni manzilga
   * qo'ysak, brauzer chegarasiga (~2000 belgi) urilardi va havola
   * o'qib bo'lmaydigan ko'rinishga kelardi.
   *
   * `sessionStorage` — faqat shu yorliq (tab) uchun va brauzer yopilishi
   * bilan o'chadi. Serverga hech narsa saqlanmaydi.
   */
  function useForLessonPlan() {
    if (analysis === null) return;

    const handoff: VisionHandoff = {
      subject: analysis.subject,
      grade: analysis.grade,
      topic: analysis.topic,
      sourceMaterial: [analysis.description, ...analysis.keyContent].join("\n"),
    };

    try {
      window.sessionStorage.setItem(VISION_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      // Maxfiylik rejimida saqlab bo'lmasligi mumkin — bunday holatda
      // forma shunchaki bo'sh ochiladi, ilova buzilmaydi.
    }

    router.push("/dashboard/lesson-plans/new");
  }

  return (
    <>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError !== null && <FormError message={formError} />}

          {/* ── Rasm tanlash ───────────────────────────────────────────── */}
          {preview === null ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                acceptFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-10",
                dragging
                  ? "border-primary bg-primary-soft"
                  : "border-neutral-300 bg-neutral-50",
              )}
            >
              <span
                aria-hidden
                className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary-soft text-primary"
              >
                <ImagePlus className="size-8" />
              </span>

              <p className="mt-4 text-lg font-semibold text-neutral-900">
                {t("dropTitle")}
              </p>
              <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-neutral-600">
                {t("dropHint")}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {/*
                  `capture="environment"` — telefonda ORQA kamerani ochadi.
                  Kompyuterda bu atribut e'tiborsiz qoladi va oddiy fayl
                  tanlash oynasi chiqadi, ya'ni zarar qilmaydi.
                */}
                <Button
                  size="lg"
                  onClick={() => cameraInput.current?.click()}
                  icon={<Camera aria-hidden className="size-5" />}
                >
                  {t("takePhoto")}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                  icon={<ImagePlus aria-hidden className="size-5" />}
                >
                  {t("chooseFile")}
                </Button>
              </div>

              <input
                ref={cameraInput}
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                hidden
                onChange={(event) => acceptFile(event.target.files?.[0])}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={(event) => acceptFile(event.target.files?.[0])}
              />

              <p className="mt-4 text-sm text-neutral-500">{t("formatHint")}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-base font-medium break-all text-neutral-800">
                  {fileName}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={loading}
                  aria-label={t("removeImage")}
                  icon={<X aria-hidden className="size-5" />}
                >
                  <span className="hidden sm:inline">{t("removeImage")}</span>
                </Button>
              </div>

              {/*
                `next/image` EMAS, oddiy `<img>`: manba — brauzerdagi
                `data:` URI, u optimallashtirishdan o'tmaydi va Next
                uni qabul qilmaydi.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={t("previewAlt")}
                className="mt-3 max-h-80 w-full rounded-md object-contain"
              />
            </div>
          )}

          {/* ── Ixtiyoriy ishoralar ────────────────────────────────────── */}
          <div className="grid gap-6 sm:grid-cols-2">
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
          </div>

          <div>
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
              disabled={preview === null}
              icon={loading ? undefined : <Sparkles aria-hidden className="size-5" />}
            >
              {loading ? t("analyzing") : t("submit")}
            </Button>
            <p className="mt-3 text-center text-base text-neutral-600">
              {loading ? tRoot("common.almostReady") : t("timeNotice")}
            </p>
          </div>
        </form>
      </Card>

      {analysis === null
        ? !loading &&
          preview === null && (
            <EmptyState
              icon={<Camera aria-hidden className="size-9" />}
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
        : null}

      {analysis !== null && <AnalysisView analysis={analysis} onUse={useForLessonPlan} />}
    </>
  );
}

const EXAMPLE_KEYS = ["first", "second", "third"] as const;

function AnalysisView({
  analysis,
  onUse,
}: {
  analysis: VisionAnalysis;
  onUse: () => void;
}) {
  const t = useTranslations("vision");

  /*
    Model rasmni o'qiy olmagan bo'lsa, natijani "tahlil" sifatida
    ko'rsatmaymiz: o'qituvchi taxminiy ma'lumotga ishonib dars
    tayyorlashi mumkin edi.
  */
  if (!analysis.usable) {
    return (
      <ToneCard tone="accent" className="mt-6">
        <div className="flex gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-6 shrink-0 text-accent" />
          <div>
            <p className="text-lg font-semibold text-accent-ink">{t("notUsableTitle")}</p>
            <p className="mt-2 text-base leading-relaxed text-accent-ink">
              {analysis.problem ?? t("notUsableDefault")}
            </p>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              {t("notUsableHint")}
            </p>
          </div>
        </div>
      </ToneCard>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold text-neutral-900">{t("resultTitle")}</h2>

      <ToneCard tone="primary" className="mt-4">
        <p className="text-lg leading-relaxed text-primary-ink">{analysis.description}</p>

        <dl className="mt-4 grid gap-3 border-t border-primary-border pt-4 sm:grid-cols-3">
          {(
            [
              ["subject", analysis.subject],
              ["grade", analysis.grade],
              ["topic", analysis.topic],
            ] as const
          ).map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm font-medium text-primary-ink/70">{t(key)}</dt>
              <dd className="mt-1 text-base font-semibold text-primary-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </ToneCard>

      <Card className="mt-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
          >
            <ListChecks className="size-6" />
          </span>
          <h3 className="text-xl font-semibold text-neutral-900">{t("keyContent")}</h3>
        </div>

        <ul className="mt-4 space-y-2">
          {analysis.keyContent.map((item, index) => (
            <li key={index} className="flex gap-3 text-base text-neutral-700">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6">
        <Button size="lg" fullWidth onClick={onUse}>
          {t("useForLessonPlan")}
        </Button>
        <p className="mt-3 text-center text-base text-neutral-600">
          {t("useForLessonPlanHint")}
        </p>
      </div>
    </section>
  );
}
