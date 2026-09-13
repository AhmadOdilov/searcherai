/**
 * Foydalanuvchi matnini tozalash.
 *
 * ── Bu qanchalik muhim (halol baho) ───────────────────────────────────────
 * XSS xavfi bu ilovada deyarli YO'Q va u shu tozalashsiz ham yo'q edi:
 *
 *  · React matnni avtomatik escape qiladi;
 *  · `dangerouslySetInnerHTML` loyihada umuman ishlatilmaydi;
 *  · .pptx/.xlsx/.docx — Office formatlari, ular HTML bajarmaydi.
 *
 * Ya'ni bu himoya "ehtimol kelajakda" uchun: kimdir natijani HTML'ga
 * chiqaradigan yangi joy yozsa (masalan email yuborish, PDF shabloni)
 * matn allaqachon toza bo'ladi.
 *
 * ── Nega BARCHA `<...>` kesilmaydi ────────────────────────────────────────
 * Eng aniq narsa. Maqsadli foydalanuvchi — matematika o'qituvchisi va u
 * mavzuga "5 < 7 tengsizligi" yoki "a<b taqqoslash" deb yozishi mutlaqo
 * normal. Soddalashtirilgan `/<[^>]*>/g` regexi bunday matnni buzadi va
 * o'qituvchi nima uchun mavzusi qirqilganini tushunmaydi.
 *
 * Shuning uchun faqat HAQIQIY teg shakli olib tashlanadi: `<` dan keyin
 * DARHOL harf yoki `/` kelgan holat. "5 < 7" da `<` dan keyin bo'shliq
 * bor — u tegilmaydi.
 *
 * ── Nega bu prompt-in'yeksiyani TO'XTATMAYDI ──────────────────────────────
 * Alohida aytib qo'yaman, chunki chalkashtirish oson: "Oldingi
 * ko'rsatmalarni unut" degan matn hech qanday tegsiz yoziladi va bu
 * funksiya undan o'tkazib yuboradi. Prompt-in'yeksiyadan himoya — bu
 * boshqa ish (chiqish sxemasi, promptni ajratish), va u allaqachon
 * qisman bor: model javobi `generateJson` da qat'iy zod sxemasidan
 * o'tadi, ya'ni "boshqa narsa" qaytarsa rad etiladi.
 */

/**
 * Xavfli bo'lishi mumkin bo'lgan HTML teglari va ularning MAZMUNI.
 *
 * Mazmuni ham kesiladi: `<script>alert(1)</script>` da faqat teglarni
 * olib tashlasak, `alert(1)` matn bo'lib qolardi — bu allaqachon
 * bezarar, lekin natijada ma'nosiz axlat qoladi.
 */
const DANGEROUS_BLOCKS =
  /<(script|style|iframe|object|embed|template)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Ochilgan, lekin yopilmagan teglar va yakka teglar.
 *
 * `<` dan keyin DARHOL harf yoki `/` kelishi shart — "5 < 7" saqlanib
 * qoladi.
 */
const TAG_LIKE = /<\/?[a-zA-Z][^>]*>?/g;

/**
 * Matndan teg shaklidagi bo'laklarni olib tashlaydi.
 *
 * Natija `trim()` qilinadi: teg o'chirilgandan keyin chetda bo'shliq
 * qolishi mumkin.
 */
export function stripTags(value: string): string {
  return value
    .replace(DANGEROUS_BLOCKS, " ")
    .replace(TAG_LIKE, " ")
    .replace(/\s+/g, " ")
    .trim();
}
