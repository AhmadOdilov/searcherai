"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Play } from "lucide-react";
import { useEditorDraft } from "@/lib/hooks/use-editor-draft";
import { SaveBar } from "@/components/editor/save-bar";
import { SlideForm } from "@/components/presentations/slide-form";
import { SlideList } from "@/components/presentations/slide-list";
import { SlidePreview } from "@/components/presentations/slide-preview";
import { Button } from "@/components/ui/button";
import { Card, ToneCard } from "@/components/ui/card";
import {
  EDIT_MAX_SLIDES,
  type PresentationContent,
  type Slide,
} from "@/lib/validations/presentation";

/**
 * Prezentatsiya muharriri.
 *
 * ── Tartib ────────────────────────────────────────────────────────────────
 * Kengroq ekranda ikki ustun: chapda slaydlar ro'yxati (navigatsiya),
 * o'ngda tanlangan slaydning formasi. Telefonda ular ustma-ust tushadi
 * — ro'yxat avval, forma keyin. Bu "desktopni kichraytirish" emas:
 * telefonda ro'yxat qisqartirilgan (amallar faqat tanlangan slaydda
 * ko'rinadi) va forma butun kenglikni oladi.
 *
 * ── Nega "Ko'rish" muharrirning ichida ────────────────────────────────────
 * O'qituvchi bandni tuzatib, DARHOL qanday ko'rinishini tekshirmoqchi.
 * Agar buning uchun saqlab, boshqa sahifaga o'tish kerak bo'lsa — u
 * tekshirmaydi. Ko'rish rejimi qoralamani ko'rsatadi, ya'ni saqlanmagan
 * o'zgarishlar ham ko'rinadi.
 */
export function PresentationEditor({
  presentationId,
  initialContent,
  detailHref,
}: {
  presentationId: string;
  initialContent: PresentationContent;
  detailHref: string;
}) {
  const t = useTranslations("presentations.editor");
  const tEditor = useTranslations("editor");
  const router = useRouter();

  const { draft, update, dirty, status, error, save, discard } =
    useEditorDraft<PresentationContent>({
      endpoint: `/api/presentations/${presentationId}`,
      initial: initialContent,
    });

  const [activeIndex, setActiveIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const slides = draft.slides;
  // Ro'yxat qisqarganda tanlov chegaradan chiqib qolmasin.
  const activeSafe = Math.min(activeIndex, slides.length - 1);
  const active = slides[activeSafe];

  function setSlides(next: Slide[]) {
    update((current) => ({ ...current, slides: next }));
  }

  function handleAdd() {
    if (slides.length >= EDIT_MAX_SLIDES) return;

    // Yangi slayd tanlanganning ORQASIGA qo'yiladi — o'qituvchi odatda
    // ketma-ket yozadi, oxiriga sakrash kerak emas.
    const at = activeSafe + 1;
    const blank: Slide = { type: "content", heading: "", bullets: [] };

    const next = [...slides];
    next.splice(at, 0, blank);
    setSlides(next);
    setActiveIndex(at);
  }

  function handleDuplicate(index: number) {
    if (slides.length >= EDIT_MAX_SLIDES) return;

    const next = [...slides];
    // Chuqur nusxa: bandlar massivi baham ko'rilmasin, aks holda
    // nusxani tahrirlash aslini ham o'zgartirardi.
    next.splice(index + 1, 0, { ...slides[index], bullets: [...slides[index].bullets] });
    setSlides(next);
    setActiveIndex(index + 1);
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;

    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next);
    setActiveIndex(target);
  }

  function handleToggleHidden(index: number) {
    const next = [...slides];
    next[index] = {
      ...next[index],
      hidden: next[index].hidden === true ? undefined : true,
    };
    setSlides(next);
  }

  function handleDelete(index: number) {
    setSlides(slides.filter((_, i) => i !== index));
    setActiveIndex(Math.max(0, index - 1));
    setPendingDelete(null);
  }

  /** Muharrirdan chiqish — saqlanmagan o'zgarish bo'lsa so'raydi. */
  function handleLeave() {
    if (dirty) {
      setLeaveConfirm(true);
      return;
    }
    router.push(detailHref);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* ── Sarlavha qatori ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleLeave}
          className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ArrowLeft aria-hidden className="size-5 shrink-0" />
          {t("backToPresentation")}
        </button>

        <Button
          variant="secondary"
          onClick={() => setPreviewOpen(true)}
          icon={<Play aria-hidden className="size-5" />}
        >
          {t("preview")}
        </Button>
      </div>

      {/* ── Chiqishni tasdiqlash ────────────────────────────────────── */}
      {leaveConfirm && (
        <ToneCard tone="accent" padding="sm" className="mt-4" role="alert">
          <p className="text-base leading-relaxed text-accent-ink">
            {tEditor("unsaved.body")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                const okSaved = await save();
                if (okSaved) router.push(detailHref);
              }}
              loading={status === "saving"}
            >
              {tEditor("unsaved.saveAndLeave")}
            </Button>
            <Button variant="ghost" onClick={() => router.push(detailHref)}>
              {tEditor("unsaved.leave")}
            </Button>
            <Button variant="ghost" onClick={() => setLeaveConfirm(false)}>
              {tEditor("unsaved.stay")}
            </Button>
          </div>
        </ToneCard>
      )}

      {/* ── Prezentatsiya nomi ──────────────────────────────────────── */}
      <div className="mt-4">
        <label
          htmlFor="presentation-title"
          className="mb-2 block text-base font-medium text-neutral-800"
        >
          {t("presentationTitle")}
        </label>
        <input
          id="presentation-title"
          type="text"
          value={draft.title}
          maxLength={150}
          onChange={(event) =>
            update((current) => ({ ...current, title: event.target.value }))
          }
          className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 py-2 text-lg font-semibold text-neutral-900 transition-colors focus:border-primary"
        />
      </div>

      {/* ── Saqlash xatosi ──────────────────────────────────────────── */}
      {status === "error" && (
        <ToneCard tone="danger" padding="sm" className="mt-4" role="alert">
          <p className="text-base leading-relaxed text-danger-ink">
            {error ?? tEditor("errors.network")}
          </p>
        </ToneCard>
      )}

      {/* ── Asosiy tartib ───────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div>
          <SlideList
            slides={slides}
            activeIndex={activeSafe}
            onSelect={setActiveIndex}
            onAdd={handleAdd}
            onMove={handleMove}
            onDuplicate={handleDuplicate}
            onToggleHidden={handleToggleHidden}
            onRequestDelete={setPendingDelete}
          />

          {/*
            O'chirishni tasdiqlash — ro'yxatning ostida, o'sha joyning
            o'zida. Brauzerning `confirm()` oynasi inglizcha tugmalar
            bilan chiqadi va sahifani muzlatadi.
          */}
          {pendingDelete !== null && (
            <ToneCard tone="danger" padding="sm" className="mt-3" role="alert">
              <p className="text-base font-medium text-danger-ink">
                {t("confirmDeleteSlide", { number: pendingDelete + 1 })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" onClick={() => handleDelete(pendingDelete)}>
                  {t("confirmDeleteYes")}
                </Button>
                <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                  {tEditor("cancel")}
                </Button>
              </div>
            </ToneCard>
          )}
        </div>

        <Card>
          {active === undefined ? (
            <p className="text-base text-neutral-500">{t("noSlides")}</p>
          ) : (
            <SlideForm
              slide={active}
              index={activeSafe}
              total={slides.length}
              onChange={(next) => {
                const updated = [...slides];
                updated[activeSafe] = next;
                setSlides(updated);
              }}
            />
          )}
        </Card>
      </div>

      <SaveBar dirty={dirty} status={status} onSave={save} onDiscard={discard} />

      {previewOpen && (
        <SlidePreview
          content={draft}
          startIndex={activeSafe}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <p className="mt-6 text-center text-sm text-neutral-500">
        {t("noAiHint")}{" "}
        <Link href={detailHref} className="text-primary underline underline-offset-4">
          {t("backToPresentation")}
        </Link>
      </p>
    </div>
  );
}
