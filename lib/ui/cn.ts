/**
 * Shartli class nomlarini birlashtiradi.
 *
 * `clsx` yoki `tailwind-merge` o'rniga o'n qatorlik funksiya: loyihada
 * class'lar bir joyda (komponentlarda) yoziladi va bir-birini bekor
 * qiladigan darajada murakkab emas. Qo'shimcha bog'liqlik — qo'shimcha
 * yuk va yangilanish majburiyati.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
