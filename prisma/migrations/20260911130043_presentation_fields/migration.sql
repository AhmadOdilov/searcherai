/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Presentation` table. All the data in the column will be lost.
  - Added the required column `topic` to the `Presentation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Presentation" DROP COLUMN "fileUrl",
ADD COLUMN     "aiDurationMs" INTEGER,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "topic" TEXT NOT NULL,
ALTER COLUMN "title" DROP NOT NULL;
