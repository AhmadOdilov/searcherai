/**
 * Qidiruv natijasidan boshqa modullarga (Word dars ishlanma, PowerPoint slaydlar, Excel taqvim/test reja)
 * o'tish uchun triggerlar va tezkor harakatlarni (Generator Handoff — Phase 19) shakllantirish.
 */

import type { QueryUnderstanding } from "./understanding";

export type OrchestrationActionType =
  | "create_lesson_plan"
  | "create_presentation"
  | "create_calendar_plan";

export interface OrchestrationAction {
  type: OrchestrationActionType;
  generatorTarget: "docx" | "pptx" | "xlsx";
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
      calendarTitle: "Taqvim-mavzu reja va test (Excel) yaratish",
      calendarDesc: "Chorak yoki yillik soatlar taqsimoti, test va kutilayotgan natijalar jadvalini olish",
    },
    RU: {
      lessonPlanTitle: "Создать поурочный план (Word)",
      lessonPlanDesc: "Сгенерировать полный конспект урока на 45 минут по теме",
      presentationTitle: "Создать презентацию (PPTX)",
      presentationDesc: "Подготовить набор слайдов для демонстрации на уроке",
      calendarTitle: "Календарный план и тесты (Excel)",
      calendarDesc: "Сформировать таблицу распределения часов, тестов и результатов",
    },
    EN: {
      lessonPlanTitle: "Generate Lesson Plan (Word)",
      lessonPlanDesc: "Generate a complete 45-minute lesson plan and notes for this topic",
      presentationTitle: "Generate Presentation (PPTX)",
      presentationDesc: "Prepare presentation slides for classroom demonstration",
      calendarTitle: "Generate Calendar & Assessment (Excel)",
      calendarDesc: "Create quarterly schedule, test assessments and outcome matrix",
    },
  }[detectedLanguage];

  const queryParams = new URLSearchParams();
  if (detectedSubject) queryParams.set("subject", detectedSubject);
  if (detectedGrade) queryParams.set("grade", detectedGrade);
  queryParams.set("topic", extractedTopic);

  // 1. Dars ishlanma (Word — docx)
  actions.push({
    type: "create_lesson_plan",
    generatorTarget: "docx",
    title: labels.lessonPlanTitle,
    description: labels.lessonPlanDesc,
    url: `/lesson-plans?${queryParams.toString()}`,
    payload: {
      subject: detectedSubject,
      grade: detectedGrade,
      topic: extractedTopic,
    },
  });

  // 2. Prezentatsiya (PowerPoint — pptx)
  actions.push({
    type: "create_presentation",
    generatorTarget: "pptx",
    title: labels.presentationTitle,
    description: labels.presentationDesc,
    url: `/presentations?${queryParams.toString()}`,
    payload: {
      subject: detectedSubject,
      grade: detectedGrade,
      topic: extractedTopic,
    },
  });

  // 3. Taqvim-mavzu reja va test baholash (Excel — xlsx)
  actions.push({
    type: "create_calendar_plan",
    generatorTarget: "xlsx",
    title: labels.calendarTitle,
    description: labels.calendarDesc,
    url: `/calendar-plans?${queryParams.toString()}`,
    payload: {
      subject: detectedSubject,
      grade: detectedGrade,
      topic: extractedTopic,
    },
  });

  // Intentga qarab eng mos generatorni birinchi o'ringa chiqarish
  if (detectedIntent === "presentation") {
    const pIdx = actions.findIndex((a) => a.type === "create_presentation");
    if (pIdx > 0) {
      const [pAction] = actions.splice(pIdx, 1);
      actions.unshift(pAction);
    }
  } else if (
    detectedIntent === "curriculum" ||
    detectedIntent === "quiz_test" ||
    detectedIntent === "assessment"
  ) {
    const cIdx = actions.findIndex((a) => a.type === "create_calendar_plan");
    if (cIdx > 0) {
      const [cAction] = actions.splice(cIdx, 1);
      actions.unshift(cAction);
    }
  } else {
    const lIdx = actions.findIndex((a) => a.type === "create_lesson_plan");
    if (lIdx > 0) {
      const [lAction] = actions.splice(lIdx, 1);
      actions.unshift(lAction);
    }
  }

  // O'quvchi rejimida taqvim reja (o'qituvchi yillik rejasi) ikkinchi darajali qilinadi
  if (understanding.audience === "student") {
    return actions.filter((a) => a.type !== "create_calendar_plan");
  }

  return actions;
}
