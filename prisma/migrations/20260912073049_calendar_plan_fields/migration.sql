/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `CalendarPlan` table. All the data in the column will be lost.
  - Added the required column `startDate` to the `CalendarPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CalendarPlan" DROP COLUMN "fileUrl",
ADD COLUMN     "aiDurationMs" INTEGER,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "rowCount" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "title" TEXT;
