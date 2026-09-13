import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/card";
import { HelpLink } from "@/components/ui/help-link";
import { SearchPanel } from "@/components/search/search-panel";

/**
 * `/dashboard/search` — o'qituvchining savoliga AI javobi.
 *
 * Sahifaning o'zi Server Component: faqat sarlavha va tarjimalar.
 * Butun interaktivlik `SearchPanel` ichida — u forma holatini va
 * javobni boshqaradi.
 */
export default async function SearchPage() {
  const t = await getTranslations("search");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <BackLink href="/dashboard" labelKey="backToDashboard" />

      <div className="mt-4">
        <PageHeader title={t("title")} description={t("pageHint")} />
      </div>

      <SearchPanel />

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
