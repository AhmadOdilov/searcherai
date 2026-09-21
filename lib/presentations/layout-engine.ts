import type { Slide, SlideLayout, SlideType } from "@/lib/validations/presentation";
import type { ContentType } from "@/lib/presentations/storyline";

/**
 * MAKET DVIGATELI — maket qarori QABUL QILINADIGAN yagona joy.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * V6 gacha renderer ikkitagina chizish funksiyasiga ega edi: sarlavha
 * slaydi va "sarlavha + bandlar" slaydi. Natijada 10 slaydli
 * prezentatsiyaning 9 tasi AYNAN bir xil ko'rinardi. Aynan shu narsa
 * "eski uslubdagi PowerPoint" taassurotini beradi.
 *
 * ── Nega maketni AI tanlamaydi ────────────────────────────────────────────
 * AI maket nomini o'zi aytsa, natija barqaror bo'lmaydi: bir xil so'rovda
 * turli maketlar chiqadi, mavjud bo'lmagan maket nomi kelishi mumkin va
 * uni tekshirish yana bir xato manbai bo'ladi.
 *
 * Shuning uchun AI MAZMUN beradi (kartalar, bosqichlar, raqam, chart),
 * maketni esa shu yerdagi deterministik qoidalar tanlaydi.
 *
 * ── Nega maket qarori BITTA joyda ─────────────────────────────────────────
 * Ilgari qaror IKKI joyda edi: quvur `layoutForContentType` bilan maketni
 * tanlar va uni yozuvga yozardi, keyin `generatePptx` o'sha yozuvni
 * `planLayouts()` bilan QAYTA hisoblardi. Ikkinchi hisob birinchisini
 * bekor qilishi mumkin edi va bekor qilish mazmunni tekshirmasdi:
 *
 *     reja "kartalar" dedi  →  renderer "statement" ga o'tkazdi
 *     →  `addStatementSlide` faqat `keyMessage` ni chizadi
 *     →  kartalar faylga umuman tushmadi.
 *
 * 8 mavzuli o'lchovda 68 slayddan 13 tasi aynan shu sababdan mazmunini
 * yo'qotgan edi. Endi qoida qat'iy:
 *
 *     PLANNER TANLAYDI → YOZUV SAQLAYDI → RENDERER FAQAT CHIZADI.
 *
 * Renderer bu fayldan faqat `legacyLayoutFor()` ni chaqiradi va u ham
 * MAKET YO'Q eski yozuvlar uchun — ya'ni yozuvda qaror umuman bo'lmagan
 * holat uchun.
 *
 * ── Vizual ritm qayerda ───────────────────────────────────────────────────
 * Ketma-ket bir xil maketlar prezentatsiyani zeriktiradi, lekin bu
 * PLANNER masalasi: `lib/presentations/slide-plan.ts` ketma-ket uchinchi
 * bir xil mazmun shaklini almashtiradi. Renderer qatlamidagi ikkinchi,
 * undan qattiqroq qoida ATAYLAB olib tashlandi — u xilma-xillikni
 * mazmun hisobiga sotib olardi.
 */

/**
 * MAKETSIZ (eski) slayd uchun maketni mazmundan keltirib chiqaradi.
 *
 * ── Bu renderer qarori EMAS ───────────────────────────────────────────────
 * Bazadagi eski `content` yozuvlarida `layout` maydoni yo'q — u V6 da
 * qo'shilgan. Bunday yozuvda tanlanadigan qaror UMUMAN yo'q, shuning
 * uchun uni mazmundan tiklash yagona yo'l. Maketi BOR yozuvga bu
 * funksiya hech qachon qo'llanmaydi.
 */
export function legacyLayoutFor(slide: Slide): SlideLayout {
  // Yozuvda qaror bo'lsa — u hurmat qilinadi, boshqa hech narsa qaralmaydi.
  if (slide.layout) return slide.layout;

  /*
    Muqovani `type` BELGILAYDI, pozitsiya emas.

    Ilgari bu yerda `index === 0` sharti ham bor edi va u regressiya
    keltirib chiqardi: qisqa deckda (masalan ikkita slayd) mazmun slaydi
    birinchi o'rinda tursa, u muqovaga aylanib, bandlari sarlavha ostidagi
    kichik matnga aylanib qolardi.
  */
  if (slide.type === "title") return "cover";

  /*
    Tartib MUHIM: eng aniq signal eng oldin tekshiriladi.
    Chart > statistika > taqqoslash > bosqichlar > kartalar > iqtibos.

    DIQQAT: bu tekshiruvlar `type === "summary"` dan OLDIN turadi.
    Sabab: kartali xulosa slaydi `conclusion` maketiga tushsa, uning
    kartalari chizilmay qolardi — aynan P0-2 nuqsoni.
  */
  if (slide.chart) return "chart";
  if (slide.statistic) return "statistic";
  if (slide.comparison) return "comparison";

  if (slide.steps && slide.steps.length > 0) {
    // Bosqichlarda tavsif bo'lsa — process, faqat yorliq bo'lsa — timeline.
    const hasBodies = slide.steps.some((s) => (s.body ?? "").length > 0);
    return hasBodies ? "process" : "timeline";
  }

  if (slide.cards && slide.cards.length > 0) {
    return slide.cards.length >= 4 ? "fourCards" : "threeCards";
  }

  if (slide.quote) return "quote";

  // Xulosa — `bullets` maketning o'ziga xos ko'rinishi (boshqa rang).
  if (slide.type === "summary") return "conclusion";

  /*
    Bandsiz, lekin asosiy fikri bor slayd — bu "statement" slaydi:
    bitta kuchli jumla butun ekranni egallaydi.
  */
  if (slide.keyMessage && slide.bullets.length === 0) return "statement";

  return "bullets";
}

/** Maket mazmun bilan RENDER QILINADIGAN holatda mosmi. */
function layoutIsRenderable(slide: Slide, layout: SlideLayout): boolean {
  switch (layout) {
    case "chart":
      return Boolean(slide.chart);
    case "statistic":
      return Boolean(slide.statistic);
    case "comparison":
      return Boolean(slide.comparison);
    case "timeline":
    case "process":
      return Boolean(slide.steps && slide.steps.length >= 3);
    case "threeCards":
      return Boolean(slide.cards && slide.cards.length >= 2 && slide.cards.length <= 3);
    case "fourCards":
      return Boolean(slide.cards && slide.cards.length === 4);
    case "quote":
      return Boolean(slide.quote);
    case "statement":
      return Boolean(slide.keyMessage);
    case "bullets":
      return slide.bullets.length > 0 || Boolean(slide.keyMessage);
    case "cover":
    case "conclusion":
      return true;
  }
}

/** Mazmun shaklining "tabiiy" maketi — slayd maqsadidan qat'i nazar. */
function shapeLayoutFor(contentType: ContentType, slide: Slide): SlideLayout {
  switch (contentType) {
    case "statement":
      return "statement";
    case "bullets":
      return "bullets";
    case "cards":
      return (slide.cards?.length ?? 0) >= 4 ? "fourCards" : "threeCards";
    case "steps":
      return slide.steps?.some((step) => (step.body ?? "").length > 0)
        ? "process"
        : "timeline";
    case "comparison":
      return "comparison";
    case "statistic":
      return "statistic";
    case "chart":
      return "chart";
    case "quote":
      return "quote";
  }
}

/**
 * MAZMUN SHAKLIDAN maket — quvurning YAGONA maket qarori.
 *
 * ── Nega mazmundan emas, shakldan ─────────────────────────────────────────
 * `legacyLayoutFor` maketni TAYYOR mazmundan keltirib chiqaradi va bu
 * eski yozuvlar uchun to'g'ri. Quvurda esa qaror ERTAROQ qabul qilinadi:
 * mazmun shakli ("uchta tushuncha") matn yozilishidan OLDIN ma'lum va AI
 * unga qarab yozadi.
 *
 * Natija baribir mazmunga qarshi TEKSHIRILADI: model kartalar so'ralgan
 * slaydda kartalarni qaytarmasa, maket mazmunga mos zaxiraga tushadi.
 *
 * ── Nega `summary` alohida ko'rib chiqiladi ───────────────────────────────
 * `summary` — slaydning MAQSADI, `contentType` esa mazmun SHAKLI. Ilgari
 * ikkisi bir tushunchaga qo'shib yuborilgan edi: har qanday xulosa
 * slaydi `conclusion` maketiga tushardi. `conclusion` esa amalda
 * `bullets` maketning boshqa rangli ko'rinishi, ya'ni faqat bandlarni
 * chizadi. Zichlik qoidasi kartalar uchun bandlarni bo'shatgani sababli
 * natija sarlavha + sahifa raqamidan iborat BO'SH slayd bo'lardi.
 *
 * Endi `conclusion` faqat bandli/bir jumlali xulosaga qo'llanadi —
 * ya'ni u haqiqatan mos kelgan holatda. Kartalar, bosqichlar va
 * taqqoslash o'z maketida qoladi; xulosa ekanini renderer `slide.type`
 * dan biladi va sarlavhani xulosa rangida chizadi.
 */
export function layoutForContentType(
  contentType: ContentType,
  slideType: SlideType,
  slide: Slide,
): SlideLayout {
  // Muqova — hikoyadagi o'rni bilan belgilanadi, mazmun shakli bilan emas.
  if (slideType === "title") return "cover";

  const candidate = shapeLayoutFor(contentType, slide);

  // Reja mazmun bilan mos kelmasa — mazmunning o'zidan kelib chiqamiz.
  const chosen = layoutIsRenderable(slide, candidate)
    ? candidate
    : legacyLayoutFor({ ...slide, layout: undefined });

  if (slideType === "summary" && (chosen === "bullets" || chosen === "statement")) {
    return "conclusion";
  }

  return chosen;
}

/** Prezentatsiyadagi maket xilma-xilligi (0..1) — QA uchun. */
export function layoutVariety(layouts: SlideLayout[]): number {
  if (layouts.length === 0) return 0;
  return new Set(layouts).size / layouts.length;
}
