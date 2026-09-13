import { getTranslations } from "next-intl/server";
import { BookOpen, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listLessonPlans } from "@/lib/lesson-plans/service";
import { LessonPlanList } from "@/components/lesson-plans/plan-list";
import { PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpLink } from "@/components/ui/help-link";
import { PAGE_SIZE } from "@/lib/ui/pagination";

/** `/dashboard/lesson-plans` — dars ishlanmalari ro'yxati. */
export default async function LessonPlansPage() {
  const user = (await getCurrentUser())!;
  const { items, nextCursor } = await listLessonPlans(user.id, {
    limit: PAGE_SIZE,
  });

  const t = await getTranslations("lessonPlans");
  const tRoot = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <PageHeader
        title={t("title")}
        // Har sahifada bitta jumla: bu yerda nima qilinadi.
        description={t("pageHint")}
        action={
          <LinkButton
            href="/dashboard/lesson-plans/new"
            size="lg"
            icon={<Plus aria-hidden className="size-5" />}
          >
            {t("new.submit")}
          </LinkButton>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<BookOpen aria-hidden className="size-9" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <LinkButton href="/dashboard/lesson-plans/new" size="lg">
              {tRoot("common.start")}
            </LinkButton>
          }
        />
      ) : (
        <>
          <p className="mt-6 text-base text-neutral-600">
            {t("count", { count: items.length })}
          </p>
          <LessonPlanList initialItems={items} initialCursor={nextCursor} />
        </>
      )}

      <div className="mt-10 flex justify-center border-t border-neutral-200 pt-6">
        <HelpLink />
      </div>
    </div>
  );
}
