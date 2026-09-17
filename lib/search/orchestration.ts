/**
 * Qidiruv natijasidan boshqa modullarga (Word dars ishlanma, PowerPoint slaydlar, Excel taqvim reja)
 * o'tish uchun triggerlar va tezkor harakatlarni (handoff) shakllantirish.
 */

import type { QueryUnderstanding } from "./understanding";

export type OrchestrationActionType =
  | "create_lesson_plan"
  | "create_presentation"
  | "create_calendar_plan";

export interface OrchestrationAction {
  type: OrchestrationActionType;
  title: string;
  description: string;
  url: string;
  payload: {
    subject?: string;
    grade?: string;
    topic: string;
  };
}

export function buildOrchestrationActions(
  understanding: QueryUnderstanding,
): OrchestrationAction[] {
  const { detectedSubject, detectedGrade, extractedTopic, detectedIntent, detectedLanguage } = understanding;

  const actions: OrchestrationAction[] = [];

  const labels = {
    UZ: {
      lessonPlanTitle: "Dars ishlanma (Word) yaratish",
      lessonPlanDesc: "Mavzu bo'yicha 45 daqiqalik to'liq dars ishlanmasi va konspekt generatsiya qilish",
      presentationTitle: "Prezentatsiya (PPTX) yaratish",
      presentationDesc: "Sinfda ko'rgazmali namoyish qilish uchun slaydlar to'plami tayyorlash",
      calendarTitle: "Taqvim-mavzu reja (Excel) yaratish",
      calendarDesc: "Chorak yoki yillik soatlar taqsimoti va kutilayotgan natijalar jadvalini olish",
    },
    RU: {
      lessonPlanTitle: "Создать поурочный план (Word)",
      lessonPlanDesc: "Сгенерировать полный конспект урока на 45 минут по теме",
      presentationTitle: "Создать презентацию (PPTX)",
      presentationDesc: "Подготовить набор слайдов для демонстрации на уроке",
      calendarTitle: "Календарный план (Excel)",
      calendarDesc: "Сформировать таблицу распределения часов на четверть или год",
    },
    EN: {
      lessonPlanTitle: "Generate Lesson Plan (Word)",
      lessonPlanDesc: "Generate a complete 45-minute lesson plan and notes for this topic",
      presentationTitle: "Generate Presentation (PPTX)",
      presentationDesc: "Prepare presentation slides for classroom demonstration",
      calendarTitle: "Generate Calendar Plan (Excel)",
      calendarDesc: "Create quarterly or annual schedule and outcome table",
    },
  }[detectedLanguage];

  const queryParams = new URLSearchParams();
  if (detectedSubject) queryParams.set("subject", detectedSubject);
  if (detectedGrade) queryParams.set("grade", detectedGrade);
  queryParams.set("topic", extractedTopic);

  // 1. Dars ishlanma (Word) tavsiyasi
  actions.push({
    type: "create_lesson_plan",
    title: labels.lessonPlanTitle,
    description: labels.lessonPlanDesc,
    url: `/lesson-plans?${queryParams.toString()}`,
    payload: {
      subject: detectedSubject,
      grade: detectedGrade,
      topic: extractedTopic,
    },
  });

  // 2. Prezentatsiya (PPTX) tavsiyasi
  actions.push({
    type: "create_presentation",
    title: labels.presentationTitle,
    description: labels.presentationDesc,
    url: `/presentations?${queryParams.toString()}`,
    payload: {
      subject: detectedSubject,
      grade: detectedGrade,
      topic: extractedTopic,
    },
  });

  // 3. Taqvim-mavzu reja (Excel) tavsiyasi — ayniqsa o'quv dasturi, soatlar yoki fan rejalari so'ralganda
  if (detectedIntent === "curriculum" || detectedIntent === "worksheet") {
    actions.unshift({
      type: "create_calendar_plan",
      title: labels.calendarTitle,
      description: labels.calendarDesc,
      url: `/calendar-plans?${queryParams.toString()}`,
      payload: {
        subject: detectedSubject,
        grade: detectedGrade,
        topic: extractedTopic,
      },
    });
  } else {
    actions.push({
      type: "create_calendar_plan",
      title: labels.calendarTitle,
      description: labels.calendarDesc,
      url: `/calendar-plans?${queryParams.toString()}`,
      payload: {
        subject: detectedSubject,
        grade: detectedGrade,
        topic: extractedTopic,
      },
    });
  }

  // Agar intent presentation bo'lsa, presentationni birinchi o'ringa olib chiqamiz
  if (detectedIntent === "presentation") {
    const pIdx = actions.findIndex((a) => a.type === "create_presentation");
    if (pIdx > 0) {
      const [pAction] = actions.splice(pIdx, 1);
      actions.unshift(pAction);
    }
  }

  return actions;
}
