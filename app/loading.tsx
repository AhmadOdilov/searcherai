/**
 * Sahifalar orasida o'tishda ko'rinadigan ekran.
 *
 * Matn ATAYLAB yo'q: bu bir necha yuz millisekund ko'rinadi, matn esa
 * o'qishga ulgurilmaydi va faqat "miltillash" hissini beradi.
 * Aylanuvchi belgi "ishlayapti" degan xabarni matnsiz yetkazadi.
 */
export default function Loading() {
  return (
    <div
      // Skrinrider uchun: bu yuklanish holati ekanini bildiradi.
      role="status"
      aria-busy="true"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <span
        aria-hidden
        className="inline-block size-10 animate-spin rounded-full border-[3px] border-neutral-200 border-t-primary"
      />
      <span className="sr-only">Yuklanmoqda</span>
    </div>
  );
}
