-- Prezentatsiya shabloni (klassik / zamonaviy / rangli).
--
-- Standart qiymat bilan qo'shiladi, ya'ni mavjud yozuvlar "klassik"
-- bo'lib qoladi — bu ularning ilgari yasalgan fayllariga mos keladi.
ALTER TABLE "Presentation" ADD COLUMN "template" TEXT NOT NULL DEFAULT 'klassik';
