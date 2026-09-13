import { getTranslations } from "next-intl/server";
import { withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import { getLessonPlan } from "@/lib/lesson-plans/service";
import { generateLessonPlanDocx } from "@/lib/docx/generate";
import { contentDispositionFor, mimeTypeFor } from "@/lib/storage/files";
import { parseLessonPlanContent } from "@/lib/validations/lesson-plan";

/**
 * `GET /api/lesson-plans/[id]/export` — dars ishlanmasini Word'da beradi.
 *
 * ── Nega saqlangan fayl emas, HAR SAFAR yasaladi ──────────────────────────
 * Prezentatsiya va kalendar reja fayllari generatsiya paytida bir marta
 * yasalib, saqlagichga yoziladi. Bu yerda esa manba — bazadagi `content`
 * ustuni, u esa "qaytadan yaratish" bilan o'zgarishi mumkin. Faylni
 * saqlab qo'ysak, o'qituvchi yangilangan ishlanmani so'rab, ESKI faylni
 * olib ketardi.
 *
 * Yasash ~50 ms, ya'ni keshlashga arzimaydi.
 *
 * ── Til ───────────────────────────────────────────────────────────────────
 * Hujjatdagi sarlavhalar ("Dars maqsadi", "Bosqichlar") INTERFEYS tilida
 * bo'ladi, dars mazmuni esa o'zi qaysi tilda yaratilgan bo'lsa — shunday
 * qoladi. O'qituvchi interfeysni ruscha ishlatib, o'zbekcha dars olishi
 * mumkin; hujjat sarlavhalari esa u tushunadigan tilda bo'lgani ma'qul.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const plan = await getLessonPlan(id, user.id);
  if (!plan) throw apiErrors.notFound("errors.domain.lessonPlanNotFound");

  if (plan.status === "PENDING") {
    throw apiErrors.validation(undefined, "errors.domain.lessonPlanPending");
  }
  if (plan.status === "FAILED" || plan.content === null) {
    throw apiErrors.validation(undefined, "errors.domain.lessonPlanFailed");
  }

  const content = parseLessonPlanContent(plan.content);
  if (content === null) {
    throw apiErrors.validation(undefined, "errors.domain.lessonPlanBroken");
  }

  const t = await getTranslations("lessonPlans");

  const buffer = await generateLessonPlanDocx({
    topic: plan.topic,
    subject: plan.subject,
    grade: plan.grade,
    durationMinutes: plan.durationMinutes,
    lessonTypeName: t(`types.${plan.lessonType}`),
    content,
    labels: {
      subject: t("fields.subject"),
      grade: t("fields.grade"),
      duration: t("fields.duration"),
      lessonType: t("fields.lessonType"),
      objective: t("detail.objective"),
      outcomes: t("detail.outcomes"),
      resources: t("detail.resources"),
      stages: t("detail.stages"),
      stageColumn: t("detail.stageColumn"),
      assessment: t("detail.assessment"),
      teacher: t("detail.teacher"),
      students: t("detail.students"),
      minutes: (value) => t("detail.minutesShort", { minutes: value }),
      totalMinutes: (value) => t("detail.totalMinutes", { minutes: value }),
    },
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": mimeTypeFor("docx"),
      "content-disposition": contentDispositionFor(plan.topic, "docx"),
      "content-length": String(buffer.length),
      // Shaxsiy hujjat — hech qanday kesh saqlamasin.
      "cache-control": "private, no-store",
    },
  });
});

/** Hujjat yasash tez, lekin baza so'rovi bilan birga zaxira vaqt qoldiramiz. */
export const maxDuration = 60;
