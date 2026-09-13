-- CreateTable
CREATE TABLE "CurriculumTopic" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedHours" INTEGER,
    "expectedOutcomes" TEXT[],
    "source" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumTopic_subject_grade_idx" ON "CurriculumTopic"("subject", "grade");
