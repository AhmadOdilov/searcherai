/**
 * Generatsiya yiqilganda ko'rsatiladigan panel.
 *
 * Uch modulda ham bir xil edi — shuning uchun umumiy komponentga
 * chiqarildi. Matnlar tashqaridan tayyor tarjima sifatida keladi, chunki
 * har bir modulning o'z sarlavhasi bor.
 */
export function ErrorPanel({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <p className="mt-2 text-xs text-red-600">{hint}</p>
    </div>
  );
}
