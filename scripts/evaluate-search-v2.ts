/**
 * 150 ta real ta'limiy query bilan Searcher AI Intelligence V2 benchmarkini o'lchash skripti.
 *
 * Dataset taqsimoti:
 *  - Uzbek: 50 ta
 *  - Russian: 30 ta
 *  - English: 20 ta
 *  - Teacher: 20 ta
 *  - Student: 20 ta
 *  - Ambiguous / Typo / Difficult: 10 ta
 * Jami: 150 ta query.
 */

import { understandQuery } from "../lib/search/understanding";
import { matchCurriculumTopics } from "../lib/search/curriculum-matcher";
import { prisma } from "../lib/db";
import type { LanguageCode } from "../lib/validations/common";
import type { SearchIntent, AudienceMode } from "../lib/search/understanding";

export interface BenchmarkQuery {
  q: string;
  expectedLanguage: LanguageCode;
  expectedSubject?: string;
  expectedGrade?: string;
  expectedIntent: SearchIntent;
  expectedAudience: AudienceMode;
  expectedCurriculumTopic?: string; // Bazadagi topicName qismi (agar bo'lsa)
}

export const BENCHMARK_DATASET: BenchmarkQuery[] = [
  // ==================== UZBEK (50 ta) ====================
  { q: "5-sinf matematika natural sonlarni qo'shish va ayirish dars ishlanmasi", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "NATURAL SONLARNI QO" },
  { q: "5-sinf matematika oddiy kasrlar dars ishlanmasi", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "ODDIY KASRLAR" },
  { q: "5-sinf matematika geometrik shakllar va burchaklar slaydlar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "GEOMETRIK SHAKLLAR" },
  { q: "5-sinf matematika o'nli kasrlar test savollari", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher", expectedCurriculumTopic: "O‘NLI KASRLAR" },
  { q: "5-sinf matematika matnli masalalarni yechish metodikasi", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher", expectedCurriculumTopic: "MATNLI MASALALARNI YECHISH" },
  { q: "5-sinf ona tili nutq va til tushunchasi konspekt", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "5-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "SINTAKSIS VA PUNKTUATSIYA" },
  { q: "5-sinf ona tili fonetika tovushlar va harflar slayd", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "5-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "FONETIKA" },
  { q: "5-sinf ona tili so'z tarkibi asos va qo'shimcha", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "5-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "MORFOLOGIYA" },
  { q: "6-sinf matematika butun sonlar va ular ustida amallar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "BUTUN SONLAR" },
  { q: "6-sinf matematika ratsional sonlar dars ishlanma", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "6-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "MUSBAT VA MANFIY SONLAR" },
  { q: "6-sinf matematika nisbat va proporsiya ta'rifi", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "6-sinf", expectedIntent: "definition", expectedAudience: "teacher", expectedCurriculumTopic: "NISBAT VA PROPORSIYA" },
  { q: "6-sinf matematika foizlar va unga doir masalalar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "6-sinf ona tili ot so'z turkumi va uning ma'no turlari", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "SO‘Z TURKUMLARI" },
  { q: "6-sinf ona tili sifat so'z turkumi darajalari dars reja", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "6-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "SO‘Z TURKUMLARI" },
  { q: "6-sinf ona tili son so'z turkumi test", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "6-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher", expectedCurriculumTopic: "SO‘Z TURKUMLARI" },
  { q: "7-sinf algebra birhadlar va ko'phadlar dars ishlanmasi", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "BIRHADLAR VA KO‘PHADLAR" },
  { q: "7-sinf algebra qisqa ko'paytirish formulalari slaydlar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "KO‘PHADNI KO‘PAYTUVCHILARGA AJRATISH" },
  { q: "7-sinf algebra chiziqli tenglamalar sistemasi konspekt", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "BIR NOMA’LUMLI BIRINCHI DARAJALI TENGLAMALAR" },
  { q: "7-sinf algebra algebraik kasrlar va ular ustida amallar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "ALGEBRAIK KASRLAR" },
  { q: "7-sinf ona tili fe'l so'z turkumi zamonlari dars ishlanma", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "MUSTAQIL SO‘Z TURKUMLARI" },
  { q: "7-sinf ona tili ravish so'z turkumi va turlari ta'rifi", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "7-sinf", expectedIntent: "definition", expectedAudience: "teacher", expectedCurriculumTopic: "MUSTAQIL SO‘Z TURKUMLARI" },
  { q: "7-sinf ona tili bog'lovchi va ko'makchi farqi taqqosla", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "7-sinf", expectedIntent: "compare", expectedAudience: "teacher", expectedCurriculumTopic: "YORDAMCHI SO‘Z" },
  { q: "8-sinf algebra kvadrat ildizlar va irratsional sonlar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "KVADRAT TENGLAMALAR" },
  { q: "8-sinf algebra kvadrat tenglamalar va Viyet teoremasi slayd", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "KVADRAT TENGLAMALAR" },
  { q: "8-sinf algebra tengsizliklar va ularning xossalari", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "TENGSIZLIKLAR" },
  { q: "8-sinf algebra taqribiy hisoblashlar xatoliklar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "MA’LUMOTLAR TAHLILI" },
  { q: "8-sinf ona tili so'z birikmasi va gap sintaksisi", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "SINTAKSIS" },
  { q: "8-sinf ona tili gapning bosh bo'laklari ega va kesim", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "SODDA GAP SINTAKSISI" },
  { q: "8-sinf ona tili gapning ikkinchi darajali bo'laklari test", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "8-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher", expectedCurriculumTopic: "IKKINCHI DARAJALI BO‘LAKLAR" },
  { q: "8-sinf ona tili bir tarkibli gaplar turlari konspekt", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "8-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "SODDA GAP SINTAKSISI" },
  { q: "9-sinf algebra kvadratik funksiya va uning grafigi slaydlar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "KVADRATIK FUNKSIYA" },
  { q: "9-sinf algebra tenglamalar va tengsizliklar sistemasi mashqlar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "worksheet", expectedAudience: "teacher", expectedCurriculumTopic: "TENGLAMALAR VA TENGSIZLIKLAR SISTEMALARI" },
  { q: "9-sinf algebra sonli ketma-ketliklar va arifmetik progressiya", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "SONLI KETMA-KETLIKLAR" },
  { q: "9-sinf algebra geometrik progressiya formulalari", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "SONLI KETMA-KETLIKLAR" },
  { q: "9-sinf ona tili qo'shma gaplar sintaksisi dars ishlanmasi", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "9-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "QO‘SHMA GAPLAR" },
  { q: "9-sinf ona tili bog'langan qo'shma gaplar turlari slayd", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "9-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "BOG‘LANGAN QO‘SHMA GAPLAR" },
  { q: "9-sinf ona tili ergashgan qo'shma gaplar va ularning tahlili", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "9-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "ERGASH GAPLI QO‘SHMA GAPLAR" },
  { q: "10-sinf algebra trigonometrik funksiyalar va formulalar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "TRIGONOMETRIK FUNKSIYALAR" },
  { q: "10-sinf algebra ko'rsatkichli va logarifmik funksiyalar", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "KOʻRSATKICHLI VA LOGARIFMIK FUNKSIYALAR" },
  { q: "10-sinf algebra trigonometrik tenglamalar va tengsizliklar dars reja", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "TRIGONOMETRIK TENGLAMALAR VA TENGSIZLIKLAR" },
  { q: "10-sinf ona tili matn tilshunosligi va uslubiyat", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "10-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "TILIM – BOYLIGIM" },
  { q: "10-sinf ona tili ilmiy va rasmiy uslub xususiyatlari taqqosla", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "10-sinf", expectedIntent: "compare", expectedAudience: "teacher", expectedCurriculumTopic: "FAN VA TEXNOLOGIYALAR" },
  { q: "11-sinf algebra hosila tushunchasi va uning geometrik ma'nosi", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "11-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "HOSILA VA UNING TATBIQLARI" },
  { q: "11-sinf algebra boshlang'ich funksiya va integral hisoblash slayd", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "11-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "INTEGRAL VA UNING TATBIQLARI" },
  { q: "11-sinf algebra ehtimollar nazariyasi va matematika statistika", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "11-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "EHTIMOLLIK" },
  { q: "11-sinf ona tili notiqlik san'ati va ritorika asoslari dars ishlanma", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "11-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "Nutq madaniyati" },
  { q: "11-sinf ona tili jahon tillari oilasi va o'zbek tilining o'rni", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "11-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "O‘zbek tili va uning taraqqiyoti" },
  { q: "7-sinf fizika jismning zichligi va massasi masalalar", expectedLanguage: "UZ", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "8-sinf kimyo kislorodning olinishi va xossalari tajriba", expectedLanguage: "UZ", expectedSubject: "Kimyo", expectedGrade: "8-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "9-sinf biologiya o'simliklarda fotosintez va nafas olish farqi", expectedLanguage: "UZ", expectedSubject: "Biologiya", expectedGrade: "9-sinf", expectedIntent: "compare", expectedAudience: "teacher" },

  // ==================== RUSSIAN (30 ta) ====================
  { q: "план урока по математике для 5 класса обыкновенные дроби", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "ODDIY KASRLAR" },
  { q: "презентация по математике 5 класс геометрические фигуры", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "GEOMETRIK SHAKLLAR" },
  { q: "тест по математике 5 класс сложение и вычитание натуральных чисел", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher", expectedCurriculumTopic: "NATURAL SONLARNI QO" },
  { q: "конспект урока по математике 6 класс целые числа", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "6-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "BUTUN SONLAR" },
  { q: "слайды по алгебре 7 класс формулы сокращенного умножения", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "KO‘PHADNI KO‘PAYTUVCHILARGA AJRATISH" },
  { q: "поурочный план по алгебре 8 класс квадратные уравнения", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "KVADRAT TENGLAMALAR" },
  { q: "как объяснить теорему Пифагора ученикам 8 класса", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "упражнения по алгебре 9 класс квадратичная функция", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "worksheet", expectedAudience: "teacher", expectedCurriculumTopic: "KVADRATIK FUNKSIYA" },
  { q: "арифметическая прогрессия формулы и задачи 9 класс", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "SONLI KETMA-KETLIKLAR" },
  { q: "тригонометрические уравнения 10 класс поурочный план", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "TRIGONOMETRIK TENGLAMALAR VA TENGSIZLIKLAR" },
  { q: "производная функции 11 класс геометрический смысл презентация", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "11-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "HOSILA VA UNING TATBIQLARI" },
  { q: "интеграл и первообразная 11 класс краткий конспект", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "11-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "INTEGRAL VA UNING TATBIQLARI" },
  { q: "учебная программа по математике для 5 класса распределение часов", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "curriculum", expectedAudience: "teacher", expectedCurriculumTopic: "NATURAL SONLAR" },
  { q: "определение логарифмической функции 10 класс", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "definition", expectedAudience: "teacher", expectedCurriculumTopic: "KOʻRSATKICHLI VA LOGARIFMIK FUNKSIYALAR" },
  { q: "разница между правильной и неправильной дробью", expectedLanguage: "RU", expectedSubject: "Matematika", expectedIntent: "compare", expectedAudience: "teacher" },
  { q: "игры на уроке математики для 5 класса устный счет", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "вопросы к уроку физики 7 класс плотность вещества", expectedLanguage: "RU", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher" },
  { q: "законы Ньютона 9 класс план урока по физике", expectedLanguage: "RU", expectedSubject: "Fizika", expectedGrade: "9-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "строение атома химия 7 класс презентация", expectedLanguage: "RU", expectedSubject: "Kimyo", expectedGrade: "7-sinf", expectedIntent: "presentation", expectedAudience: "teacher" },
  { q: "периодический закон Менделеева 8 класс конспект", expectedLanguage: "RU", expectedSubject: "Kimyo", expectedGrade: "8-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "фотосинтез и дыхание растений биология 6 класс", expectedLanguage: "RU", expectedSubject: "Biologiya", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "кровеносная система человека биология 8 класс тест", expectedLanguage: "RU", expectedSubject: "Biologiya", expectedGrade: "8-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher" },
  { q: "история древнего мира 6 класс египетские пирамиды презентация", expectedLanguage: "RU", expectedSubject: "Tarix", expectedGrade: "6-sinf", expectedIntent: "presentation", expectedAudience: "teacher" },
  { q: "государство Амира Темура 7 класс история поурочный план", expectedLanguage: "RU", expectedSubject: "Tarix", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "материки и океаны география 6 класс задания", expectedLanguage: "RU", expectedSubject: "Geografiya", expectedGrade: "6-sinf", expectedIntent: "worksheet", expectedAudience: "teacher" },
  { q: "алгоритмы и блок схемы информатика 7 класс", expectedLanguage: "RU", expectedSubject: "Informatika", expectedGrade: "7-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "программирование на Python 8 класс практическая работа", expectedLanguage: "RU", expectedSubject: "Informatika", expectedGrade: "8-sinf", expectedIntent: "worksheet", expectedAudience: "teacher" },
  { q: "английский язык Present Perfect правила и упражнения", expectedLanguage: "RU", expectedSubject: "Ingliz tili", expectedIntent: "worksheet", expectedAudience: "teacher" },
  { q: "как объяснить закон Ома для участка цепи простыми словами", expectedLanguage: "RU", expectedSubject: "Fizika", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "методика проведения лабораторной работы по химии 8 класс", expectedLanguage: "RU", expectedSubject: "Kimyo", expectedGrade: "8-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },

  // ==================== ENGLISH (20 ta) ====================
  { q: "lesson plan for grade 5 mathematics fractions", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "ODDIY KASRLAR" },
  { q: "presentation slides grade 7 algebra linear equations", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "presentation", expectedAudience: "teacher", expectedCurriculumTopic: "TENGLAMALAR" },
  { q: "quiz questions for grade 8 geometry Pythagorean theorem", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher", expectedCurriculumTopic: "UCHBURCHAK" },
  { q: "worksheet for grade 9 quadratic equations exercises", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "worksheet", expectedAudience: "teacher", expectedCurriculumTopic: "KVADRATIK" },
  { q: "how to explain photosynthesis to grade 6 students", expectedLanguage: "EN", expectedSubject: "Biologiya", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "definition of logarithm and exponential function grade 10", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "definition", expectedAudience: "teacher", expectedCurriculumTopic: "LOGARIFMIK" },
  { q: "difference between speed and velocity physics grade 7", expectedLanguage: "EN", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "compare", expectedAudience: "teacher" },
  { q: "Newton's laws of motion lesson plan grade 9 physics", expectedLanguage: "EN", expectedSubject: "Fizika", expectedGrade: "9-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "classroom activity ideas for teaching periodic table chemistry", expectedLanguage: "EN", expectedSubject: "Kimyo", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "curriculum syllabus for grade 5 mathematics hours distribution", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "curriculum", expectedAudience: "teacher", expectedCurriculumTopic: "NATURAL SONLAR" },
  { q: "how to introduce cells and microscope in grade 6 biology", expectedLanguage: "EN", expectedSubject: "Biologiya", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "English grammar tenses past continuous lesson plan", expectedLanguage: "EN", expectedSubject: "Ingliz tili", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "python programming for beginners grade 8 exercises", expectedLanguage: "EN", expectedSubject: "Informatika", expectedGrade: "8-sinf", expectedIntent: "worksheet", expectedAudience: "teacher" },
  { q: "world history ancient Rome presentation slides", expectedLanguage: "EN", expectedSubject: "Tarix", expectedIntent: "presentation", expectedAudience: "teacher" },
  { q: "geography continents and oceans grade 6 worksheet", expectedLanguage: "EN", expectedSubject: "Geografiya", expectedGrade: "6-sinf", expectedIntent: "worksheet", expectedAudience: "teacher" },
  { q: "test questions for chemical bonds grade 8 chemistry", expectedLanguage: "EN", expectedSubject: "Kimyo", expectedGrade: "8-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher" },
  { q: "how to explain derivative of function to grade 11 students", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "11-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "HOSILA" },
  { q: "what is the difference between DNA and RNA in biology", expectedLanguage: "EN", expectedSubject: "Biologiya", expectedIntent: "compare", expectedAudience: "teacher" },
  { q: "active learning game for grade 5 math mental calculation", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "grade 10 trigonometry identities summary sheet", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "10-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "TRIGONOMETRIK" },

  // ==================== TEACHER MODE (20 ta) ====================
  { q: "sinfda 5-sinf o'quvchilariga kasrlarni qanday metod bilan tushuntiray?", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "7-sinf fizika darsiga 45 minutlik texnologik xarita tuzib ber", expectedLanguage: "UZ", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "o'quvchilarga baholash mezonlari rubrikasi matematika 6-sinf", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "6-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "kimyo darsida xavfsizlik texnikasi bo'yicha slaydlar to'plami", expectedLanguage: "UZ", expectedSubject: "Kimyo", expectedIntent: "presentation", expectedAudience: "teacher" },
  { q: "biologiya fanidan amaliy laboratoriya mashg'uloti o'tkazish metodikasi", expectedLanguage: "UZ", expectedSubject: "Biologiya", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "ona tili o'qituvchisi uchun 8-sinf dars konspekti reja", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedGrade: "8-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "geometriya darsida guruhlarda ishlash metodlari 7-sinf", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "sinfda o'quvchilarning diqqatini jamlash uchun qiziqarli mashqlar", expectedLanguage: "UZ", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "davlat ta'lim standarti bo'yicha 9-sinf matematika soatlari taqsimoti", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "9-sinf", expectedIntent: "curriculum", expectedAudience: "teacher" },
  { q: "informatika fani o'qituvchisiga kompyuter sinfida dars o'tish bo'yicha tavsiyalar", expectedLanguage: "UZ", expectedSubject: "Informatika", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "как учителю организовать групповую работу на уроке физики", expectedLanguage: "RU", expectedSubject: "Fizika", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "поурочный план для учителя математики 7 класс алгебра", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "критерии оценивания контрольной работы по химии 8 класс", expectedLanguage: "RU", expectedSubject: "Kimyo", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "раздаточный материал к уроку биологии 6 класс строение цветка", expectedLanguage: "RU", expectedSubject: "Biologiya", expectedGrade: "6-sinf", expectedIntent: "worksheet", expectedAudience: "teacher" },
  { q: "подготовка к открытому уроку по литературе 9 класс конспект", expectedLanguage: "RU", expectedSubject: "Ona tili", expectedGrade: "9-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "classroom management strategies for grade 7 teacher in math lesson", expectedLanguage: "EN", expectedSubject: "Matematika", expectedGrade: "7-sinf", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "formative assessment ideas for high school biology teachers", expectedLanguage: "EN", expectedSubject: "Biologiya", expectedIntent: "classroom_activity", expectedAudience: "teacher" },
  { q: "lesson plan template for 45 minutes physics class grade 8", expectedLanguage: "EN", expectedSubject: "Fizika", expectedGrade: "8-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "how to grade students oral presentation in literature class", expectedLanguage: "EN", expectedSubject: "Ona tili", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "darsda interaktiv metodlar klaster va bumerang usulini qo'llash", expectedLanguage: "UZ", expectedIntent: "classroom_activity", expectedAudience: "teacher" },

  // ==================== STUDENT MODE (20 ta) ====================
  { q: "menga tushunarsiz bo'lyapti, kasrlarni qo'shishni oddiy qilib tushuntirib ber", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "o'quvchiman, ertaga algebra 8-sinfdan nazorat ishim bor, kvadrat tenglama formulasini eslat", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "student" },
  { q: "uy vazifam bor edi, fizika 7-sinf zichlik formulasini tushunmadim", expectedLanguage: "UZ", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "explain", expectedAudience: "student" },
  { q: "maktabdaman 6-sinf o'quvchisiman, fotosintez nima degani o'zi?", expectedLanguage: "UZ", expectedSubject: "Biologiya", expectedGrade: "6-sinf", expectedIntent: "definition", expectedAudience: "student" },
  { q: "menga tenglamani yechish algoritmini bosqichma-bosqich ko'rsatib ber", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "ona tilidan uyga vazifa: ot va sifat farqini tushunmadim", expectedLanguage: "UZ", expectedSubject: "Ona tili", expectedIntent: "compare", expectedAudience: "student" },
  { q: "Pifagor teoremasi hayotda nimaga kerak? tushunmadim", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "kimyodan valentlik nima degani? o'quvchiman sodda qilib ayt", expectedLanguage: "UZ", expectedSubject: "Kimyo", expectedIntent: "definition", expectedAudience: "student" },
  { q: "ingliz tilidan uy vazifamni tekshirib ber Present Simple", expectedLanguage: "UZ", expectedSubject: "Ingliz tili", expectedIntent: "worksheet", expectedAudience: "student" },
  { q: "tarix darsidan testga tayyorlanyapman, Amir Temur qachon tug'ilgan?", expectedLanguage: "UZ", expectedSubject: "Tarix", expectedIntent: "explain", expectedAudience: "student" },
  { q: "я ученик 7 класса, не понял закон Паскаля по физике, объясни", expectedLanguage: "RU", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "explain", expectedAudience: "student" },
  { q: "помоги решить домашнее задание по алгебре 8 класс дискриминант", expectedLanguage: "RU", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "worksheet", expectedAudience: "student" },
  { q: "я школьник, как легко запомнить таблицу умножения?", expectedLanguage: "RU", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "не понимаю как делить дроби, объясни на яблоках", expectedLanguage: "RU", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "у меня завтра контрольная по химии, что такое молярная масса?", expectedLanguage: "RU", expectedSubject: "Kimyo", expectedIntent: "definition", expectedAudience: "student" },
  { q: "I am a student, please explain how to add fractions simply", expectedLanguage: "EN", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "I don't understand quadratic formula, can you show step by step example?", expectedLanguage: "EN", expectedSubject: "Matematika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "help with my physics homework grade 8 heat capacity", expectedLanguage: "EN", expectedSubject: "Fizika", expectedGrade: "8-sinf", expectedIntent: "worksheet", expectedAudience: "student" },
  { q: "explain Newton's second law like I am 12 years old", expectedLanguage: "EN", expectedSubject: "Fizika", expectedIntent: "explain", expectedAudience: "student" },
  { q: "menga darslikdagi 45-mashqni qanday yechishni ko'rsatib yuboring", expectedLanguage: "UZ", expectedIntent: "worksheet", expectedAudience: "student" },

  // ==================== AMBIGUOUS / TYPO / DIFFICULT (10 ta) ====================
  { q: "matimatikadan 5 sinf kasirlar darsishlanma", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher", expectedCurriculumTopic: "ODDIY KASRLAR" },
  { q: "bialogiya 8-sinf fatasintezni tushuntir", expectedLanguage: "UZ", expectedSubject: "Biologiya", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "8 sinif algebrada tanglamalar yechish", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "8-sinf", expectedIntent: "explain", expectedAudience: "teacher" },
  { q: "7-синф физикадан босим мавзусига конспект", expectedLanguage: "UZ", expectedSubject: "Fizika", expectedGrade: "7-sinf", expectedIntent: "lesson_plan", expectedAudience: "teacher" },
  { q: "massa nima degani?", expectedLanguage: "UZ", expectedIntent: "definition", expectedAudience: "teacher" }, // Disambiguation (Fizika / Kimyo)
  { q: "ildiz haqida ma'lumot ber", expectedLanguage: "UZ", expectedIntent: "explain", expectedAudience: "teacher" }, // Disambiguation (Matematika / Biologiya)
  { q: "6sinf prizintatsiya tayorlash", expectedLanguage: "UZ", expectedGrade: "6-sinf", expectedIntent: "presentation", expectedAudience: "teacher" },
  { q: "10-sinf kimiyodan davriy jadval slayd", expectedLanguage: "UZ", expectedSubject: "Kimyo", expectedGrade: "10-sinf", expectedIntent: "presentation", expectedAudience: "teacher" },
  { q: "дроблар билан ишлаш 5 синф", expectedLanguage: "UZ", expectedSubject: "Matematika", expectedGrade: "5-sinf", expectedIntent: "explain", expectedAudience: "teacher", expectedCurriculumTopic: "ODDIY KASRLAR" },
  { q: "geagrafiya materiiklar 6 sinf test", expectedLanguage: "UZ", expectedSubject: "Geografiya", expectedGrade: "6-sinf", expectedIntent: "quiz_test", expectedAudience: "teacher" },
];

async function runEvaluation() {
  console.log("==========================================================");
  console.log("   SEARCHER AI — INTELLIGENCE V2 EVALUATION (150 QUERIES)");
  console.log("==========================================================");

  let langCorrect = 0;
  let subjCorrect = 0;
  let subjEvaluated = 0;
  let gradeCorrect = 0;
  let gradeEvaluated = 0;
  let intentCorrect = 0;
  let audCorrect = 0;

  // Retrieval metrics
  let r1Count = 0;
  let r3Count = 0;
  let r5Count = 0;
  let mrrSum = 0;
  let ndcg5Sum = 0;
  let retrievalEvaluated = 0;

  let totalDbTime = 0;
  const total = BENCHMARK_DATASET.length;

  for (const item of BENCHMARK_DATASET) {
    const u = understandQuery(item.q);

    // Language
    if (u.detectedLanguage === item.expectedLanguage) {
      langCorrect++;
    }

    // Subject
    if (item.expectedSubject !== undefined) {
      subjEvaluated++;
      if (u.detectedSubject === item.expectedSubject) {
        subjCorrect++;
      }
    }

    // Grade
    if (item.expectedGrade !== undefined) {
      gradeEvaluated++;
      if (u.detectedGrade === item.expectedGrade) {
        gradeCorrect++;
      }
    }

    // Intent
    if (u.detectedIntent === item.expectedIntent) {
      intentCorrect++;
    }

    // Audience
    if (u.audience === item.expectedAudience) {
      audCorrect++;
    }

    // Retrieval evaluation
    if (item.expectedCurriculumTopic) {
      retrievalEvaluated++;
      const dbStart = Date.now();
      const matches = await matchCurriculumTopics(u, 5);
      const dbDuration = Date.now() - dbStart;
      totalDbTime += dbDuration;

      const expectedUpper = item.expectedCurriculumTopic.toUpperCase();
      let rank = 0;

      for (let i = 0; i < matches.length; i++) {
        if (matches[i].topicName.toUpperCase().includes(expectedUpper)) {
          rank = i + 1;
          break;
        }
      }

      if (rank === 1) r1Count++;
      if (rank >= 1 && rank <= 3) r3Count++;
      if (rank >= 1 && rank <= 5) r5Count++;

      if (rank > 0) {
        mrrSum += 1 / rank;
        ndcg5Sum += 1 / Math.log2(rank + 1);
      }
    }
  }

  const langAcc = ((langCorrect / total) * 100).toFixed(2);
  const subjAcc = ((subjCorrect / subjEvaluated) * 100).toFixed(2);
  const gradeAcc = ((gradeCorrect / gradeEvaluated) * 100).toFixed(2);
  const intentAcc = ((intentCorrect / total) * 100).toFixed(2);
  const audAcc = ((audCorrect / total) * 100).toFixed(2);

  const recall1 = retrievalEvaluated > 0 ? ((r1Count / retrievalEvaluated) * 100).toFixed(2) : "N/A";
  const recall3 = retrievalEvaluated > 0 ? ((r3Count / retrievalEvaluated) * 100).toFixed(2) : "N/A";
  const recall5 = retrievalEvaluated > 0 ? ((r5Count / retrievalEvaluated) * 100).toFixed(2) : "N/A";
  const mrr = retrievalEvaluated > 0 ? (mrrSum / retrievalEvaluated).toFixed(4) : "N/A";
  const ndcg5 = retrievalEvaluated > 0 ? (ndcg5Sum / retrievalEvaluated).toFixed(4) : "N/A";
  const avgDbLatency = retrievalEvaluated > 0 ? (totalDbTime / retrievalEvaluated).toFixed(2) : "0";

  console.log("\n## 1. QUERY UNDERSTANDING ACCURACY (150 Queries)");
  console.log(`- Total Queries: ${total}`);
  console.log(`- Language Accuracy: ${langAcc}% (${langCorrect}/${total})`);
  console.log(`- Subject Accuracy: ${subjAcc}% (${subjCorrect}/${subjEvaluated})`);
  console.log(`- Grade Accuracy: ${gradeAcc}% (${gradeCorrect}/${gradeEvaluated})`);
  console.log(`- Intent Accuracy: ${intentAcc}% (${intentCorrect}/${total})`);
  console.log(`- Audience Accuracy: ${audAcc}% (${audCorrect}/${total})`);

  console.log("\n## 2. RETRIEVAL QUALITY (Curriculum DB Ground Truth)");
  console.log(`- Evaluated Curriculum Queries: ${retrievalEvaluated}`);
  console.log(`- Recall@1: ${recall1}% (${r1Count}/${retrievalEvaluated})`);
  console.log(`- Recall@3: ${recall3}% (${r3Count}/${retrievalEvaluated})`);
  console.log(`- Recall@5: ${recall5}% (${r5Count}/${retrievalEvaluated})`);
  console.log(`- MRR (Mean Reciprocal Rank): ${mrr}`);
  console.log(`- nDCG@5: ${ndcg5}`);
  console.log(`- Avg DB/Retrieval Latency: ${avgDbLatency} ms`);
}

runEvaluation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
