/**
 * Zod sxemalarining yagona kirish nuqtasi.
 *
 * Keyingi modullar o'z sxemasini shu papkada alohida fayl qilib qo'shadi
 * va bu yerdan qayta eksport qiladi:
 *
 *   lib/validations/lesson-plan.ts    → Step 1 (dars ishlanmasi)
 *   lib/validations/presentation.ts   → Step 2 (prezentatsiya slaydlari)
 *   lib/validations/calendar-plan.ts  → Step 3 (Excel kalendar reja)
 *   lib/validations/auth.ts           → autentifikatsiya moduli
 */

export * from "@/lib/validations/common";
