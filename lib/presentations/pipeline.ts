import "server-only";
import { generateJson } from "@/lib/ai/provider";
import { buildBrief, type PresentationBrief } from "@/lib/presentations/brief";
import { compressSlide } from "@/lib/presentations/density";
import { layoutForContentType } from "@/lib/presentations/layout-engine";
import {
  buildLessonContextBlock,
  type PresentationPromptContext,
} from "@/lib/presentations/prompt";
import {
  allowedContentTypes,
  buildSlidePlan,
  type SlideBlueprint,
} from "@/lib/presentations/slide-plan";
import {
  buildContentUserPrompt,
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
} from "@/lib/presentations/stage-prompts";
import { planStoryline, type PlannedBeat } from "@/lib/presentations/storyline";
import { buildSystemPrompt } from "@/lib/presentations/prompt";
import { researchStatus } from "@/lib/research/provider";
import {
  outlineSchemaFor,
  type PresentationOutline,
  type PresentationPlan,
  type PlannedSlide,
} from "@/lib/validations/presentation-plan";
import {
  presentationContentSchema,
  type PresentationContent,
  type Slide,
} from "@/lib/validations/presentation";

/**
 * KO'P BOSQICHLI GENERATSIYA QUVURI.
 *
 * ── Phase 1 dagi holat ────────────────────────────────────────────────────
 *   PROMPT → BITTA AI CHAQIRUVI → BUTUN DECK
 *
 * Bu ishlardi, lekin natijada hikoya yo'q edi: model birinchi slayddan
 * boshlab matn yozardi va oxirigacha borib tuzilma haqida o'ylamasdi.
 *
 * ── Hozirgi oqim ──────────────────────────────────────────────────────────
 *   BRIF          (deterministik) — auditoriya, maqsad, arxetip, slayd soni
 *   HIKOYA        (deterministik) — arxetip beatlari kerakli songa moslanadi
 *   SKELET        (AI #1)         — har slaydning vazifasi va asosiy fikri
 *   SLAYD REJASI  (deterministik) — mazmun shakli, zichlik, vizual topshiriq
 *   MAZMUN        (AI #2)         — faqat matn
 *   SIQISH        (deterministik) — zichlik chegaralari majburan qo'llanadi
 *   MAKET         (deterministik) — Phase 1 maket dvigateli
 *
 * ── Nega deterministik bosqichlar shuncha ko'p ────────────────────────────
 * Foydalanuvchi "aynan 10 ta slayd" desa, buni AI'ga ishonib topshirish
 * kerak emas — sonni STRUKTURA hal qiladi. Xuddi shunday: maket,
 * zichlik va vizual topshiriq ham qoidalar bilan hisoblanadi. AI faqat
 * o'zi eng yaxshi bajaradigan ishni qiladi — MATN yozadi.
 *
 * Natijada bir xil so'rov har doim bir xil skeletni beradi va uni
 * sinov bilan qulflash mumkin.
 */

export interface PipelineResult {
  content: PresentationContent;
  plan: PresentationPlan;
  brief: PresentationBrief;
  meta: {
    model: string;
    totalDurationMs: number;
    inputTokens: number;
    outputTokens: number;
    schemaAttempts: number;
  };
}

/**
 * Prezentatsiyani bosqichma-bosqich yaratadi.
 *
 * Har qanday bosqichda xato bo'lsa — xato YUQORIGA ko'tariladi.
 * "Zaxira sifatida bitta chaqiruvli eski oqim" ATAYLAB qo'shilmadi:
 * u sifatsiz natijani jim berardi va nuqsonni yashirardi.
 */
export async function generatePresentationContent(
  context: PresentationPromptContext,
): Promise<PipelineResult> {
  const brief = buildBrief({
    topic: context.topic,
    subject: context.subject ?? null,
    grade: context.grade ?? null,
    language: context.language,
    lessonPlan: context.lessonPlan,
  });

  const beats = planStoryline(brief.archetype, brief.slideCount.value);
  const research = researchStatus();
  const allowed = allowedContentTypes({
    researchAvailable: research.available,
    sourceText: [context.topic, context.subject ?? "", context.grade ?? ""].join(" "),
  });

  const contextBlock = buildLessonContextBlock(context);

  // ── 1-BOSQICH: SKELET ──────────────────────────────────────────────────
  const outlineCall = await generateJson({
    schema: outlineSchemaFor(beats.length),
    systemPrompt: buildOutlineSystemPrompt(brief.language),
    prompt: buildOutlineUserPrompt({ brief, beats, allowed, contextBlock }),
  });

  const outline: PresentationOutline = outlineCall.data;

  // ── 2-BOSQICH: SLAYD REJASI (AI'siz) ───────────────────────────────────
  const blueprints = buildSlidePlan(brief, beats, outline.slides, { allowed });

  // ── 3-BOSQICH: MAZMUN ──────────────────────────────────────────────────
  const contentCall = await generateJson({
    schema: contentSchemaFor(blueprints.length),
    systemPrompt: buildSystemPrompt(brief.language),
    prompt: buildContentUserPrompt({
      brief,
      blueprints,
      title: outline.title,
      contextBlock,
    }),
  });

  // ── 4-BOSQICH: SIQISH VA MAKET ─────────────────────────────────────────
  const slides = finalizeSlides(contentCall.data.slides, blueprints);

  return {
    content: { title: outline.title, slides },
    plan: {
      archetype: brief.archetype,
      slideCountSource: brief.slideCount.source,
      slides: blueprints.map((blueprint, index) =>
        toPlannedSlide(blueprint, slides[index]),
      ),
    },
    brief,
    meta: {
      // Ikkala chaqiruv ham bir xil model bilan ketadi.
      model: contentCall.meta.model,
      totalDurationMs:
        outlineCall.meta.totalDurationMs + contentCall.meta.totalDurationMs,
      inputTokens:
        outlineCall.meta.usage.inputTokens + contentCall.meta.usage.inputTokens,
      outputTokens:
        outlineCall.meta.usage.outputTokens + contentCall.meta.usage.outputTokens,
      schemaAttempts: outlineCall.meta.schemaAttempts + contentCall.meta.schemaAttempts,
    },
  };
}

/**
 * Mazmun bosqichi uchun sxema — slaydlar soni AYNAN rejadagidek.
 *
 * Xabar modelga qaytariladi, shuning uchun u tabiiy matn va nima
 * qilish kerakligini aniq aytadi.
 */
function contentSchemaFor(slideCount: number) {
  return presentationContentSchema.superRefine((content, ctx) => {
    if (content.slides.length !== slideCount) {
      ctx.addIssue({
        code: "custom",
        path: ["slides"],
        message:
          `Javobda ${content.slides.length} ta slayd bor. ` +
          `Rejada AYNAN ${slideCount} ta slayd bor — har biriga bittadan yoz.`,
      });
    }
  });
}

/**
 * AI matnini rejaga moslaydi: siqadi, turini va maketini qo'yadi.
 *
 * ── Nega slayd turi REJADAN olinadi ───────────────────────────────────────
 * Model ba'zan oxirgi slaydni "content" deb belgilaydi yoki o'rtada
 * ikkinchi "title" slaydini qaytaradi. Tur esa hikoyadagi o'rindan
 * kelib chiqadi va u allaqachon hal qilingan.
 */
export function finalizeSlides(
  generated: Slide[],
  blueprints: SlideBlueprint[],
): Slide[] {
  return blueprints.map((blueprint, index) => {
    const raw = generated[index];

    const merged: Slide = {
      ...raw,
      type: blueprint.slideType,
      // Sarlavha bo'sh kelsa rejadagisini olamiz — bo'sh sarlavha
      // sxemadan o'tmaydi va butun generatsiyani yiqitardi.
      heading: raw.heading.trim().length >= 2 ? raw.heading : blueprint.heading,
      keyMessage: raw.keyMessage ?? (blueprint.keyMessage || undefined),
    };

    const compressed = compressSlide(merged, blueprint.density);

    return {
      ...compressed,
      layout: layoutForContentType(
        blueprint.contentType,
        blueprint.slideType,
        compressed,
      ),
    };
  });
}

/** Reja yozuvini shartnoma shakliga keltiradi. */
function toPlannedSlide(
  blueprint: SlideBlueprint,
  slide: Slide | undefined,
): PlannedSlide {
  return {
    id: blueprint.id,
    index: blueprint.index,
    beatKey: blueprint.beatKey,
    purpose: blueprint.purpose,
    keyMessage: slide?.keyMessage ?? blueprint.keyMessage,
    supportingPoints: slide?.bullets ?? [],
    contentType: blueprint.contentType,
    /*
      Raqamli ma'lumot faqat manba bo'lganda to'ldiriladi. Hozir
      tadqiqot provayderi ulanmagan, shuning uchun bu maydon amalda
      har doim `null` — va bu ATAYLAB: o'ylab topilgan raqamni
      "ma'lumot" deb saqlash eng yomon variant bo'lardi.
    */
    data:
      slide?.chart !== undefined && slide.chart.source
        ? { kind: "chart", sourceLabel: slide.chart.source }
        : slide?.statistic !== undefined && slide.source
          ? { kind: "statistic", sourceLabel: slide.source }
          : null,
    visualConcept: blueprint.visual.rationale,
    visualType: blueprint.visual.visualType,
    visualBrief: blueprint.visual.visualBrief,
    layoutType: slide?.layout ?? "bullets",
    source: slide?.source ?? null,
  };
}

/** Sinovlar uchun: rejalashtirilgan beatlarni tashqariga ochamiz. */
export function planBeatsFor(brief: PresentationBrief): PlannedBeat[] {
  return planStoryline(brief.archetype, brief.slideCount.value);
}
