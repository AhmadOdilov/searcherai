/**
 * Multi-Turn Conversation Service (Phase 10 & 14).
 *
 * Xususiyatlari:
 *  - Ko'p bosqichli suhbat kontekstini (Thread / Turn) boshqarish.
 *  - IDOR / BOLA xavfsizlik tekshiruvlari (User faqat o'z suhbatini ko'ra oladi).
 *  - Avtomatik kontekst merosi (previousTopic, previousSubject, previousGrade, previousIntent).
 *  - Retention limit (maksimal 50 turn) va eskirgan xotirani tozalash.
 */

import type { LanguageCode } from "@/lib/validations/common";
import type {
  SearchIntent,
  ConversationTurnContext,
  QueryUnderstanding,
} from "./understanding";

export interface ConversationTurn {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  query: string;
  understanding?: Partial<QueryUnderstanding>;
  responseSnippet?: string;
  createdAt: Date;
}

export interface ConversationThread {
  id: string;
  userId: string;
  title: string;
  language: LanguageCode;
  turns: ConversationTurn[];
  createdAt: Date;
  updatedAt: Date;
}

// Xotiradagi doimiy xavfsiz suhbat ombori (Database migratsiyasisiz va xavfsiz holda ishlaydi)
const IN_MEMORY_THREADS = new Map<string, ConversationThread>();
const MAX_TURNS_PER_THREAD = 50;
const THREAD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun

export class MultiTurnService {
  /**
   * Yangi suhbat oqimi (Thread) ochish
   */
  public static createThread(
    userId: string,
    title: string,
    language: LanguageCode = "UZ",
  ): ConversationThread {
    if (!userId) {
      throw new Error("Foydalanuvchi identifikatori talab qilinadi");
    }

    const threadId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const thread: ConversationThread = {
      id: threadId,
      userId,
      title: title.slice(0, 100),
      language,
      turns: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    IN_MEMORY_THREADS.set(threadId, thread);
    return thread;
  }

  /**
   * Foydalanuvchining shaxsiy suhbatini olish (IDOR himoyasi bilan)
   */
  public static getThread(threadId: string, userId: string): ConversationThread | null {
    const thread = IN_MEMORY_THREADS.get(threadId);
    if (!thread) return null;

    // IDOR / BOLA Guard: Boshqa foydalanuvchining suhbatiga kirish qat'iyan taqiqlangan
    if (thread.userId !== userId) {
      throw new Error(
        "Ruxsatsiz kirish: Ushbu suhbat boshqa foydalanuvchiga tegishli (IDOR detected)",
      );
    }

    return thread;
  }

  /**
   * Suhbatga yangi turn (savol va tahlil) qo'shish
   */
  public static addTurn(
    threadId: string,
    userId: string,
    query: string,
    understanding: QueryUnderstanding,
    responseSnippet?: string,
  ): ConversationTurn {
    const thread = this.getThread(threadId, userId);
    if (!thread) {
      throw new Error("Suhbat oqimi topilmadi");
    }

    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const turn: ConversationTurn = {
      id: turnId,
      threadId,
      role: "user",
      query,
      understanding: {
        detectedLanguage: understanding.detectedLanguage,
        detectedSubject: understanding.detectedSubject,
        detectedGrade: understanding.detectedGrade,
        detectedIntent: understanding.detectedIntent,
        extractedTopic: understanding.extractedTopic,
      },
      responseSnippet,
      createdAt: new Date(),
    };

    thread.turns.push(turn);
    thread.updatedAt = new Date();

    // Retention policy: Maksimal 50 ta turn saqlanadi
    if (thread.turns.length > MAX_TURNS_PER_THREAD) {
      thread.turns = thread.turns.slice(-MAX_TURNS_PER_THREAD);
    }

    return turn;
  }

  /**
   * Keyingi savol uchun oldingi kontekstni ajratib olish (Topic, Subject, Grade merosi)
   */
  public static getContextForNextTurn(
    threadId: string,
    userId: string,
  ): ConversationTurnContext | undefined {
    const thread = this.getThread(threadId, userId);
    if (!thread || thread.turns.length === 0) return undefined;

    // Oxirgi burilishlardan mavzu, fan va sinfni qidiramiz
    let previousTopic: string | undefined;
    let previousSubject: string | undefined;
    let previousGrade: string | undefined;
    let previousLanguage: LanguageCode | undefined;
    let previousIntent: SearchIntent | undefined;

    for (let i = thread.turns.length - 1; i >= 0; i--) {
      const u = thread.turns[i].understanding;
      if (!u) continue;

      if (!previousTopic && u.extractedTopic) previousTopic = u.extractedTopic;
      if (!previousSubject && u.detectedSubject) previousSubject = u.detectedSubject;
      if (!previousGrade && u.detectedGrade) previousGrade = u.detectedGrade;
      if (!previousLanguage && u.detectedLanguage) previousLanguage = u.detectedLanguage;
      if (!previousIntent && u.detectedIntent) previousIntent = u.detectedIntent;

      if (previousTopic && previousSubject && previousGrade) break;
    }

    return {
      previousTopic,
      previousSubject,
      previousGrade,
      previousLanguage,
      previousIntent,
    };
  }

  /**
   * Kontekst oynasi boshqaruvi (Phase 16): Oxirgi N ta turn va suhbat qisqacha mazmuni
   */
  public static getContextWindowSummary(
    threadId: string,
    userId: string,
    maxTurns: number = 5,
  ): { summary: string; recentTurns: ConversationTurn[] } {
    const thread = this.getThread(threadId, userId);
    if (!thread || thread.turns.length === 0) {
      return { summary: "", recentTurns: [] };
    }

    const recentTurns = thread.turns.slice(-maxTurns);
    const olderTurns = thread.turns.slice(0, -maxTurns);

    let summary = "";
    if (olderTurns.length > 0) {
      const topicsCovered = Array.from(
        new Set(
          olderTurns
            .map((t) => t.understanding?.extractedTopic)
            .filter((t): t is string => Boolean(t && t.length >= 3)),
        ),
      );
      summary = `Avvalgi bosqichlarda muhokama qilingan mavzular: ${topicsCovered.join(", ")} (Jami ${olderTurns.length} ta savol-javob).`;
    }

    return {
      summary,
      recentTurns,
    };
  }

  /**
   * Foydalanuvchining barcha suhbatlarini ro'yxatlash
   */
  public static listUserThreads(
    userId: string,
  ): Array<Omit<ConversationThread, "turns">> {
    const userThreads: Array<Omit<ConversationThread, "turns">> = [];
    const now = Date.now();

    for (const [id, thread] of IN_MEMORY_THREADS.entries()) {
      // 30 kunlik TTL tozalash
      if (now - thread.updatedAt.getTime() > THREAD_TTL_MS) {
        IN_MEMORY_THREADS.delete(id);
        continue;
      }

      if (thread.userId === userId) {
        const { turns: _turns, ...meta } = thread;
        userThreads.push(meta);
      }
    }

    return userThreads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Test va tozalash uchun
   */
  public static _clearAll(): void {
    IN_MEMORY_THREADS.clear();
  }
}
