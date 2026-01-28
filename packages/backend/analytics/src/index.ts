import { eq, and, sql } from 'drizzle-orm';
import { getDatabase, analyticsEvents, videoProgress, quizAttempts, startedModules, readingProgress } from '@backend/db';
import { randomUUID } from 'crypto';
import type { AnalyticsSummary, AnalyticsEventType } from './types.js';



/**
 * Track an analytics event (append-only)
 */
export async function trackEvent(
    studentId: string,
    eventType: AnalyticsEventType,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    const event = {
        id: randomUUID(),
        studentId,
        eventType,
        metadata,
        timestamp: new Date().toISOString(),
    };

    await getDatabase().insert(analyticsEvents).values(event);
}

/**
 * Get analytics summary for a student
 */
export async function getAnalyticsSummary(studentId: string): Promise<AnalyticsSummary> {
    // Total watch time from video progress
    const videoProgressData = await getDatabase()
        .select()
        .from(videoProgress)
        .where(eq(videoProgress.studentId, studentId));

    const totalWatchTime = videoProgressData.reduce(
        (sum, vp) => sum + vp.totalWatchDuration,
        0
    );

    // Total read time from reading progress
    const readingProgressData = await getDatabase()
        .select()
        .from(readingProgress)
        .where(eq(readingProgress.studentId, studentId));

    const totalReadTime = readingProgressData.reduce(
        (sum, rp) => sum + rp.totalReadDuration,
        0
    );

    // Module events
    const moduleEvents = await getDatabase()
        .select()
        .from(analyticsEvents)
        .where(
            and(
                eq(analyticsEvents.studentId, studentId),
                eq(analyticsEvents.eventType, 'module_completed')
            )
        );

    const startedModulesData = await getDatabase()
        .select()
        .from(startedModules)
        .where(eq(startedModules.studentId, studentId));

    const modulesStarted = startedModulesData.length;
    const modulesCompleted = moduleEvents.length;

    // Quiz statistics
    const quizData = await getDatabase()
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.studentId, studentId));

    const quizzesTaken = quizData.length;
    const averageQuizScore =
        quizzesTaken > 0
            ? quizData.reduce((sum, q) => sum + (q.score / q.totalQuestions) * 100, 0) /
            quizzesTaken
            : 0;

    // Last active date
    const lastEvent = await getDatabase()
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.studentId, studentId))
        .orderBy(sql`${analyticsEvents.timestamp} DESC`)
        .limit(1);

    const lastActiveDate = lastEvent[0]?.timestamp || new Date().toISOString();

    return {
        totalWatchTime,
        totalReadTime,
        modulesStarted,
        modulesCompleted,
        quizzesTaken,
        averageQuizScore: Math.round(averageQuizScore * 10) / 10, // 1 decimal
        lastActiveDate,
    };
}

/**
 * Get time spent per module for a student
 */
export async function getModuleTimeSpent(
    studentId: string,
    moduleId: string
): Promise<number> {
    const events = await getDatabase()
        .select()
        .from(analyticsEvents)
        .where(
            and(
                eq(analyticsEvents.studentId, studentId),
                sql`json_extract(${analyticsEvents.metadata}, '$.moduleId') = ${moduleId}`
            )
        );

    // Sum up watch time from metadata
    return events.reduce((sum, event) => {
        const metadata = event.metadata as any;
        return sum + (metadata.watchDuration || 0);
    }, 0);
}

export * from './types.js';
