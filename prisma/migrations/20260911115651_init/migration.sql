-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('UZ', 'RU', 'EN');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('NEW_TOPIC', 'REINFORCEMENT', 'ASSESSMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'TEACHER',
    "language" "Language" NOT NULL DEFAULT 'UZ',
    "profile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,
    "lessonType" "LessonType" NOT NULL DEFAULT 'NEW_TOPIC',
    "language" "Language" NOT NULL DEFAULT 'UZ',
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "content" JSONB,
    "errorMessage" TEXT,
    "aiModel" TEXT,
    "aiDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonPlanId" TEXT,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'UZ',
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "content" JSONB,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "slideCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'UZ',
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "content" JSONB,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "LessonPlan_userId_createdAt_idx" ON "LessonPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LessonPlan_subject_grade_idx" ON "LessonPlan"("subject", "grade");

-- CreateIndex
CREATE INDEX "LessonPlan_status_idx" ON "LessonPlan"("status");

-- CreateIndex
CREATE INDEX "Presentation_userId_createdAt_idx" ON "Presentation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Presentation_lessonPlanId_idx" ON "Presentation"("lessonPlanId");

-- CreateIndex
CREATE INDEX "Presentation_status_idx" ON "Presentation"("status");

-- CreateIndex
CREATE INDEX "CalendarPlan_userId_createdAt_idx" ON "CalendarPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CalendarPlan_subject_grade_idx" ON "CalendarPlan"("subject", "grade");

-- CreateIndex
CREATE INDEX "CalendarPlan_status_idx" ON "CalendarPlan"("status");

-- AddForeignKey
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarPlan" ADD CONSTRAINT "CalendarPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
