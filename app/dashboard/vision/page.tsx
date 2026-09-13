import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";
import { ImageAnalyzer } from "@/components/vision/image-analyzer";

/**
 * `/dashboard/vision` — rasmdan material tayyorlash.
 *
 * Sahifaning o'zi Server Component: faqat sarlavha va tarjimalar.
 * Butun interaktivlik `ImageAnalyzer` ichida.
 */
export default async function VisionPage() {
  const t = await getTranslations("vision");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard" labelKey="backToDashboard" />

      <div className="mt-4">
        <PageHeader title={t("title")} description={t("pageHint")} />
      </div>

      <ImageAnalyzer />

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
