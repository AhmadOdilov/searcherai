import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listPresentations } from "@/lib/presentations/service";
import { PresentationList } from "@/components/presentations/presentation-list";
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
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {items.length === 0 ? t("empty") : t("count", { count: items.length })}
          </p>
        </div>
        <Link
          href="/dashboard/presentations/new"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {tRoot("common.create")}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            Birinchi prezentatsiyangizni yarating
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Mavjud dars ishlanmasidan yoki faqat mavzu kiritib — tizim tayyor slaydlarni
            o&apos;zi tuzadi.
          </p>
          <Link
            href="/dashboard/presentations/new"
            className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {tRoot("common.start")}
          </Link>
        </div>
      ) : (
        <PresentationList initialItems={items} initialCursor={nextCursor} />
      )}
    </div>
  );
}
