import type { ContentType } from "@/lib/presentations/storyline";
import type { PresentationBrief } from "@/lib/presentations/brief";

/**
 * VIZUAL REJA — slaydga qanday tasvir kerakligini AYTADI, lekin uni
 * YARATMAYDI.
 *
 * ── Nega faqat reja ───────────────────────────────────────────────────────
 * Tasvir generatsiyasi hozir BLOKLANGAN: YandexART `art://yandex-art/latest`
 * modeliga kirishni 403 bilan rad etmoqda (`ai.imageGeneration.user`
 * ruxsati yo'q). Boshqa provayder ham sozlanmagan.
 *
 * Bunday holatda ikkita noto'g'ri yo'l bor edi:
 *   · tasvirni umuman rejalashtirmaslik — keyin butun qatlamni qaytadan
 *     yozishga to'g'ri kelardi;
 *   · o'rniga tayyor rasm yoki rangli to'rtburchak qo'yib, uni
 *     "generatsiya qilingan tasvir" deb ko'rsatish — bu soxta natija.
 *
 * Shuning uchun uchinchi yo'l: reja TO'LIQ tuziladi va saqlanadi, lekin
 * faylga hech qanday tasvir tushmaydi. Provayder ulanganda rejadagi
 * `visualBrief` to'g'ridan-to'g'ri so'rovga aylanadi.
 */

export const VISUAL_TYPES = [
  "none",
  "diagram",
  "chart",
  "icon_grid",
  "generated_image",
] as const;

export type VisualType = (typeof VISUAL_TYPES)[number];

export interface VisualPlan {
  visualType: VisualType;
  /**
   * Tasvir uchun topshiriq — inson ham, model ham o'qiy oladigan matn.
   *
   * `visualType: "none"` bo'lsa bo'sh satr: yo'q narsaning tavsifi
   * chalg'ituvchi bo'lardi.
   */
  visualBrief: string;
  /**
   * Nima uchun aynan shu tur tanlandi — diagnostika va Phase 6 uchun.
   */
  rationale: string;
}

/**
 * Mazmun turiga qarab vizual turini tanlaydi.
 *
 * ── Qoida ─────────────────────────────────────────────────────────────────
 * Tasvir MAZMUNNI TUSHUNTIRSA qo'shiladi, bezak uchun emas. Shuning
 * uchun bandlar slaydiga tasvir kerak emas — u yerda matnning o'zi
 * ma'lumot; bosqichlar slaydiga esa sxema kerak, chunki ketma-ketlikni
 * ko'rsatish matndan ko'ra tezroq tushuniladi.
 */
function typeFor(contentType: ContentType, isCover: boolean): VisualType {
  if (isCover) return "generated_image";

  switch (contentType) {
    case "steps":
      return "diagram";
    case "comparison":
      return "diagram";
    case "cards":
      return "icon_grid";
    case "chart":
      return "chart";
    case "statistic":
      // Katta raqamning o'zi vizual — yoniga tasvir qo'yish uni susaytiradi.
      return "none";
    case "statement":
      return "generated_image";
    case "quote":
      return "none";
    case "bullets":
      return "none";
  }
}

/** Auditoriyaga mos badiiy uslub. */
function styleFor(brief: Pick<PresentationBrief, "audience" | "audienceAge">): string {
  if (brief.audience === "investors" || brief.audience === "executives") {
    return "cinematic editorial photography, muted corporate palette";
  }
  if (brief.audienceAge !== null && brief.audienceAge <= 12) {
    return "friendly flat illustration, bright and simple shapes";
  }
  if (brief.audience === "students") {
    return "clear educational illustration, high contrast, minimal detail";
  }
  return "clean modern illustration, restrained palette";
}

export interface VisualPlanInput {
  contentType: ContentType;
  isCover: boolean;
  heading: string;
  keyMessage: string;
  purpose: string;
  brief: Pick<PresentationBrief, "audience" | "audienceAge" | "topic">;
}

/**
 * Bitta slayd uchun vizual reja.
 *
 * To'liq deterministik: bir xil kirish — bir xil topshiriq. Bu Phase 6 da
 * muhim bo'ladi (bir xil brief → keshlangan tasvir) va hozir testni
 * mumkin qiladi.
 */
export function planVisual(input: VisualPlanInput): VisualPlan {
  const visualType = typeFor(input.contentType, input.isCover);

  if (visualType === "none") {
    return {
      visualType,
      visualBrief: "",
      rationale: `"${input.contentType}" mazmuni o'zi yetarlicha vizual`,
    };
  }

  if (visualType === "diagram") {
    return {
      visualType,
      visualBrief: `Sxema: ${input.keyMessage || input.heading}. Oqim chapdan o'ngga, ortiqcha bezaksiz.`,
      rationale: "ketma-ketlik yoki qarama-qarshilik sxemada tezroq o'qiladi",
    };
  }

  if (visualType === "chart") {
    return {
      visualType,
      visualBrief: `Diagramma: ${input.heading}. Ma'lumot slayd mazmunidan olinadi, o'ylab topilmaydi.`,
      rationale: "raqamli qator diagrammada ko'rinadi",
    };
  }

  if (visualType === "icon_grid") {
    return {
      visualType,
      visualBrief: `Har bir kartaga bittadan sodda chiziqli belgi: ${input.heading}.`,
      rationale: "kartalar belgi bilan tezroq ajratiladi",
    };
  }

  /*
    `generated_image` — muqova va kuchli bitta fikr slaydlari uchun.
    Topshiriqda matn uchun JOY so'raladi: aks holda sarlavha tasvir
    ustiga tushib o'qilmay qoladi.
  */
  return {
    visualType,
    visualBrief: [
      input.isCover ? input.brief.topic : input.keyMessage || input.heading,
      styleFor(input.brief),
      "chap tomonda sarlavha uchun bo'sh joy, matnsiz",
    ].join(", "),
    rationale: input.isCover
      ? "muqova tasviri prezentatsiyaning kayfiyatini belgilaydi"
      : "bitta kuchli fikr to'liq ekranli tasvir bilan kuchayadi",
  };
}
