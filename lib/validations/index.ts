/**
 * Zod sxemalarining yagona kirish nuqtasi.
 *
 * Keyingi modullar o'z sxemasini shu papkada alohida fayl qilib qo'shadi
 * va bu yerdan qayta eksport qiladi:
 *
 *   lib/validations/lesson-plan.ts    → dars ishlanmasi ✅
 *   lib/validations/presentation.ts   → prezentatsiya slaydlari ✅
 *   lib/validations/calendar-plan.ts  → Excel kalendar reja ✅
 *   lib/validations/auth.ts           → autentifikatsiya ✅
 */

export * from "@/lib/validations/common";
export * from "@/lib/validations/auth";
export * from "@/lib/validations/lesson-plan";
export * from "@/lib/validations/presentation";
export * from "@/lib/validations/calendar-plan";
