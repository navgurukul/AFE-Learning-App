import { eq } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import {
    localFeedbacks,
    type LocalFeedback,
    type NewLocalFeedback,
    students,
    videoProgress,
    quizAttempts,
    analyticsEvents,
    aiSessions,
    aiChatHistory,
    startedModules,
    readingProgress,
    learningSummaries,
    afeSessions
} from '../schema/index.js';

/**
 * Save a new local feedback entry
 */
export async function saveLocalFeedback(feedback: NewLocalFeedback): Promise<LocalFeedback> {
    const db = getDatabase();
    await db.insert(localFeedbacks).values(feedback);
    const [saved] = await db.select().from(localFeedbacks).where(eq(localFeedbacks.id, feedback.id));
    return saved;
}

/**
 * Get all unsynced feedback records
 */
export async function getUnsyncedFeedbacks(): Promise<LocalFeedback[]> {
    const db = getDatabase();
    return await db.select().from(localFeedbacks).where(eq(localFeedbacks.synced, false));
}

/**
 * Mark a feedback record as synced
 */
export async function markFeedbackAsSynced(id: string): Promise<void> {
    const db = getDatabase();
    await db.update(localFeedbacks).set({
        synced: true,
        syncedAt: new Date().toISOString()
    }).where(eq(localFeedbacks.id, id));
}

/**
 * Get the latest user-submitted feedback (BUG or SUGGESTION) to enforce hourly rate limiting
 */
export async function getLastUserFeedback(): Promise<LocalFeedback | null> {
    const db = getDatabase();
    const rows = await db.select().from(localFeedbacks);
    const userFeedbacks = rows
        .filter(f => f.feedbackType === 'BUG' || f.feedbackType === 'SUGGESTION')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return userFeedbacks[0] || null;
}

/**
 * Completely purge and delete ALL user-created and session data from SQLite DB.
 * Produces a CLEAN SLATE for the application.
 */
export async function purgeAllDatabaseData(): Promise<void> {
    const db = getDatabase();
    await db.transaction(async (tx) => {
        // Child tables with foreign keys deleted first or cascaded
        await tx.delete(aiChatHistory);
        await tx.delete(aiSessions);
        await tx.delete(videoProgress);
        await tx.delete(quizAttempts);
        await tx.delete(analyticsEvents);
        await tx.delete(startedModules);
        await tx.delete(readingProgress);
        await tx.delete(learningSummaries);
        await tx.delete(afeSessions);
        await tx.delete(localFeedbacks);
        await tx.delete(students);
    });
}
