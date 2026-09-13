import { getTranslations } from "next-intl/server";
import { Presentation, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listPresentations } from "@/lib/presentations/service";
import { PresentationList } from "@/components/presentations/presentation-list";
import { PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpLink } from "@/components/ui/help-link";
import { PAGE_SIZE } from "@/lib/ui/pagination";

/** `/dashboard/presentations` — prezentatsiyalar ro'yxati. */
export default async function PresentationsPage() {
  const user = (await getCurrentUser())!;
  const { items, nextCursor } = await listPresentations(user.id, {
    limit: PAGE_SIZE,
  });

  const t = await getTranslations("presentations");
  const tRoot = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <PageHeader
        title={t("title")}
        // Har sahifada bitta jumla: bu yerda nima qilinadi.
        description={t("pageHint")}
        action={
          <LinkButton
            href="/dashboard/presentations/new"
            size="lg"
            icon={<Plus aria-hidden className="size-5" />}
          >
            {t("new.submit")}
          </LinkButton>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Presentation aria-hidden className="size-9" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <LinkButton href="/dashboard/presentations/new" size="lg">
              {tRoot("common.start")}
            </LinkButton>
          }
        />
      ) : (
        <>
          <p className="mt-6 text-base text-neutral-600">
            {t("count", { count: items.length })}
          </p>
          <PresentationList initialItems={items} initialCursor={nextCursor} />
        </>
      )}

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
