import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPresentation } from "@/lib/presentations/service";
import { PresentationEditor } from "@/components/presentations/presentation-editor";
import { ErrorPanel } from "@/components/ui/error-panel";
import { BackLink } from "@/components/ui/back-link";
import { parsePresentationContent } from "@/lib/validations/presentation";

/**
 * `/dashboard/presentations/[id]/edit` — slaydlarni tahrirlash.
 *
 * ── Nega ALOHIDA manzil, tafsilot sahifasidagi rejim emas ─────────────────
 * Uch sabab:
 *  1. Manzil — holat. Sahifa yangilansa yoki havola saqlansa, o'qituvchi
 *     o'sha muharrirga qaytadi.
 *  2. Tafsilot sahifasi allaqachon to'la: yuklab olish paneli, amallar,
 *     slaydlar ro'yxati. Muharrirni ham qo'shsak, telefonda u cheksiz
 *     uzun bo'lib ketardi.
 *  3. Saqlanmagan o'zgarishlar chegarasi aniq bo'ladi: muharrirdan
 *     chiqish — bitta amal, uni tekshirish oson.
 *
 * ── Tekshiruvlar SERVER tomonida ──────────────────────────────────────────
 * Egalik (`getPresentation` `userId` bilan qidiradi), holat va mazmun
 * shakli — hammasi shu yerda. Muharrir komponenti allaqachon tayyor
 * ma'lumot oladi va hech narsani qayta tekshirmaydi.
 */
export default async function PresentationEditPage({
  params,
}: PageProps<"/dashboard/presentations/[id]/edit">) {
  const { id } = await params;
  const user = (await getCurrentUser())!;

  const presentation = await getPresentation(id, user.id);
  // Begona yoki mavjud bo'lmagan yozuv — bir xil javob (404).
  if (!presentation) notFound();

  const detailHref = `/dashboard/presentations/${id}`;

  /*
    Tayyor bo'lmagan yozuvni tahrirlab bo'lmaydi: PENDING'da mazmun hali
    yo'q, FAILED'da umuman bo'lmaydi. Foydalanuvchini bo'sh muharrirga
    tushirgandan ko'ra, tafsilot sahifasiga qaytaramiz — u yerda holat
    tushuntirilgan va «qayta urinish» tugmasi bor.
  */
  if (presentation.status !== "READY") redirect(detailHref);

  const t = await getTranslations("presentations.editor");
  const content = parsePresentationContent(presentation.content);

  if (content === null) {
    const tDetail = await getTranslations("presentations");
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <BackLink href={detailHref} labelKey="back" />
        <ErrorPanel
          title={tDetail("detail.failedTitle")}
          hint={tDetail("detail.failedHint")}
          message={tDetail("detail.brokenContent")}
        />
      </div>
    );
  }

  return (
    <>
      {/* Brauzer yorlig'ida qaysi ish ochiqligi ko'rinsin. */}
      <title>{`${t("title")} — ${content.title}`}</title>
      <PresentationEditor
        presentationId={presentation.id}
        initialContent={content}
        detailHref={detailHref}
      />
    </>
  );
}
