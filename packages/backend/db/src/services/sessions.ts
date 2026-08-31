import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import { afeSessions, type AFESession, type NewAFESession } from '../schema/index.js';

/**
 * Save a newly completed AFE Session
 */
export async function saveAFESession(session: NewAFESession): Promise<void> {
    const db = getDatabase();
    await db.insert(afeSessions).values(session);
}

/**
 * Save multiple completed AFE Sessions in a transaction
 */
export async function saveAFESessions(sessions: NewAFESession[]): Promise<void> {
    if (!sessions || sessions.length === 0) return;
    const db = getDatabase();
    await db.transaction(async (tx) => {
        for (const s of sessions) {
            await tx.insert(afeSessions).values(s);
        }
    });
}

/**
 * Get all unsynced AFE Sessions
 */
export async function getUnsyncedSessions(): Promise<AFESession[]> {
    const db = getDatabase();
    return await db.select().from(afeSessions).where(eq(afeSessions.synced, false));
}

/**
 * Mark a list of session IDs as synced
 */
export async function markSessionsAsSynced(sessionIds: string[]): Promise<void> {
    const db = getDatabase();
    for (const id of sessionIds) {
        await db.update(afeSessions).set({ synced: true }).where(eq(afeSessions.id, id));
    }
}

/**
 * Get count of sessions for a student on a specific date (for incremental session sequence number)
 */
export async function getSessionCountForDate(studentId: string, dateStr: string): Promise<number> {
    const db = getDatabase();
    const result = await db.select().from(afeSessions).where(
        eq(afeSessions.sessionDate, dateStr)
    );
    return result.length;
}

/**
 * Get all recorded session IDs (for historical backfill)
 */
export async function getAllSessionIds(): Promise<string[]> {
    const db = getDatabase();
    const result = await db.select({ id: afeSessions.id }).from(afeSessions);
    return result.map(r => r.id);
}

/**
 * Get all recorded sessions
 */
export async function getAllSessions(): Promise<AFESession[]> {
    const db = getDatabase();
    return await db.select().from(afeSessions);
}

