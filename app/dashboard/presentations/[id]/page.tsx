import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPresentation } from "@/lib/presentations/service";
import { StatusBadge } from "@/components/ui/status-badge";
import { PresentationActions } from "@/components/presentations/presentation-actions";
import { LANGUAGE_LABELS, formatDate, formatFileSize } from "@/lib/ui/labels";
import {
  parsePresentationContent,
  type PresentationContent,
} from "@/lib/validations/presentation";

/** `/dashboard/presentations/[id]` — prezentatsiyani ko'rish va yuklab olish. */
export default async function PresentationDetailPage({
  params,
}: PageProps<"/dashboard/presentations/[id]">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const presentation = await getPresentation(id, user.id);
  if (!presentation) notFound();

  const content =
    presentation.content === null ? null : parsePresentationContent(presentation.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/dashboard/presentations"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← Ro&apos;yxatga qaytish
      </Link>

      <header className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {presentation.title ?? presentation.topic}
          </h1>
          <StatusBadge status={presentation.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {[presentation.subject, presentation.grade].filter(Boolean).join(" · ") ||
            "Mustaqil prezentatsiya"}
          {" · "}
          {LANGUAGE_LABELS[presentation.language]} tili
          {presentation.slideCount !== null && ` · ${presentation.slideCount} slayd`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {formatDate(presentation.createdAt)}
          {presentation.aiDurationMs !== null &&
            ` · ${(presentation.aiDurationMs / 1000).toFixed(1)} soniyada yaratilgan`}
        </p>

        {presentation.lessonPlanId !== null && (
          <p className="mt-2 text-xs text-slate-500">
            Dars ishlanmasi asosida —{" "}
            <Link
              href={`/dashboard/lesson-plans/${presentation.lessonPlanId}`}
              className="underline hover:text-slate-700"
            >
              ishlanmani ko&apos;rish
            </Link>
          </p>
        )}
      </header>

      {/* ── Yuklab olish ─────────────────────────────────────────────── */}
      {presentation.status === "READY" && presentation.filePath !== null && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">Prezentatsiya tayyor</p>
          <p className="mt-1 text-xs text-emerald-800">
            PowerPoint (.pptx) formatida — yuklab olib tahrirlashingiz mumkin.
          </p>
          {/*
            Oddiy havola (fetch emas): brauzer faylni o'zi yuklab oladi va
            `Content-Disposition` sarlavhasidagi nomni ishlatadi. Cookie
            avtomatik ketadi, ya'ni egalik tekshiruvi ishlaydi.
          */}
          <a
            href={`/api/presentations/${presentation.id}/download`}
            className="mt-3 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Yuklab olish
            {presentation.fileSize !== null &&
              ` · ${formatFileSize(presentation.fileSize)}`}
          </a>
        </div>
      )}

      <div className="mt-5">
        <PresentationActions
          presentationId={presentation.id}
          status={presentation.status}
        />
      </div>

      {/* ── Holatga qarab mazmun ─────────────────────────────────────── */}
      {presentation.status === "FAILED" && (
        <ErrorPanel message={presentation.errorMessage} />
      )}

      {presentation.status === "PENDING" && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Prezentatsiya hali yaratilmoqda. Sahifani birozdan so&apos;ng yangilang.
        </p>
      )}

      {presentation.status === "READY" && content === null && (
        <ErrorPanel
          message={
            "Slaydlar saqlangan, lekin ularni o'qib bo'lmadi (format mos kelmadi). " +
            "«Qaytadan yaratish» tugmasini bosing."
          }
        />
      )}

      {presentation.status === "READY" && content !== null && (
        <SlidesPreview content={content} />
      )}
    </div>
  );
}

function ErrorPanel({ message }: { message: string | null }) {
  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-800">
        Prezentatsiyani yaratib bo&apos;lmadi
      </p>
      <p className="mt-1 text-sm text-red-700">{message ?? "Sabab aniqlanmadi."}</p>
      <p className="mt-2 text-xs text-red-600">
        Yuqoridagi «Qayta urinish» tugmasini bosing — kiritgan ma&apos;lumotlaringiz
        saqlangan.
      </p>
    </div>
  );
}

/**
 * Slaydlar ko'rinishi.
 *
 * Fayl yuklab olinmasdan ham nima chiqqanini ko'rish uchun — o'qituvchi
 * PowerPoint ochmasdan tekshiradi va kerak bo'lsa qaytadan yaratadi.
 */
function SlidesPreview({ content }: { content: PresentationContent }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Slaydlar ({content.slides.length})
      </h2>

      <ol className="space-y-3">
        {content.slides.map((slide, index) => (
          <li
            key={index}
            className={`rounded-xl border p-4 ${
              slide.type === "title"
                ? "border-slate-800 bg-slate-900"
                : slide.type === "summary"
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3
                className={`text-sm font-semibold ${
                  slide.type === "title" ? "text-white" : "text-slate-900"
                }`}
              >
                <span
                  className={`mr-1.5 ${
                    slide.type === "title" ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {index + 1}.
                </span>
                {slide.heading}
              </h3>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                  slide.type === "title"
                    ? "bg-slate-700 text-slate-200"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {SLIDE_TYPE_LABELS[slide.type]}
              </span>
            </div>

            {slide.bullets.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {slide.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bulletIndex}
                    className={`flex gap-2 text-sm ${
                      slide.type === "title" ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    <span className="select-none text-slate-400">•</span>
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {slide.speakerNotes !== undefined && (
              <p
                className={`mt-3 border-t pt-2.5 text-xs leading-relaxed ${
                  slide.type === "title"
                    ? "border-slate-700 text-slate-400"
                    : "border-slate-100 text-slate-500"
                }`}
              >
                <span className="font-medium">So&apos;zlovchi izohi: </span>
                {slide.speakerNotes}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

const SLIDE_TYPE_LABELS = {
  title: "Sarlavha",
  content: "Mazmun",
  summary: "Xulosa",
} as const;
