-- CreateTable
CREATE TABLE "SearchConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'UZ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "understanding" JSONB,
    "retrievedTopicIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchConversation_userId_updatedAt_idx" ON "SearchConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SearchMessage_conversationId_createdAt_idx" ON "SearchMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SearchConversation" ADD CONSTRAINT "SearchConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchMessage" ADD CONSTRAINT "SearchMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SearchConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
