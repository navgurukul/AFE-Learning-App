import { getDatabase, students, dailySyncSnapshots, videoProgress, readingProgress, quizAttempts, startedModules, analyticsEvents, learningSummaries, type DailySyncSnapshot, type NewDailySyncSnapshot } from '@backend/db';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { DeviceInfo } from '@afe/shared';

export class DailySyncService {
    private deviceInfo: DeviceInfo;

    constructor(deviceInfo: DeviceInfo) {
        this.deviceInfo = deviceInfo;
    }

    /**
     * Get the date of the last snapshot created
     */
    private async getLastSnapshotDate(): Promise<string | null> {
        const db = getDatabase();

        const result = await db
            .select({ snapshotDate: dailySyncSnapshots.snapshotDate })
            .from(dailySyncSnapshots)
            .orderBy(sql`${dailySyncSnapshots.snapshotDate} DESC`)
            .limit(1);

        return result[0]?.snapshotDate || null;
    }

    /**
     * Generate date range from startDate to yesterday (inclusive)
     */
    private generateDateRange(startDate: string, endDate: string): string[] {
        const dates: string[] = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    /**
     * Get yesterday's date in YYYY-MM-DD format
     */
    private getYesterday(): string {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    /**
     * Calculate metrics for a specific student on a specific date
     */
    private async calculateMetricsForDate(studentId: string, date: string): Promise<{
        modulesStarted: number;
        modulesCompleted: number;
        timeWatched: number;
        timeRead: number;
        avgQuizScore: number;
        learningSummaryText: string | null;
        learningSummaryProgressNote: string | null;
        learningSummaryUpdatedAt: string | null;
    }> {
        const db = getDatabase();
        const datePlusOne = new Date(date);
        datePlusOne.setDate(datePlusOne.getDate() + 1);
        const nextDate = datePlusOne.toISOString().split('T')[0];

        // Get modules started on this date
        const modulesStartedResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(startedModules)
            .where(
                and(
                    eq(startedModules.studentId, studentId),
                    sql`${startedModules.startedAt} >= ${date} AND ${startedModules.startedAt} < ${nextDate}`
                )
            );

        // Get modules completed on this date
        const modulesCompletedResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(analyticsEvents)
            .where(
                and(
                    eq(analyticsEvents.studentId, studentId),
                    eq(analyticsEvents.eventType, 'module_completed'),
                    sql`${analyticsEvents.timestamp} >= ${date} AND ${analyticsEvents.timestamp} < ${nextDate}`
                )
            );

        // Get total watch time on this date
        const watchTimeResult = await db
            .select({ total: sql<number>`SUM(${videoProgress.totalWatchDuration})` })
            .from(videoProgress)
            .where(
                and(
                    eq(videoProgress.studentId, studentId),
                    sql`${videoProgress.lastWatchedAt} >= ${date} AND ${videoProgress.lastWatchedAt} < ${nextDate}`
                )
            );

        // Get total read time on this date
        const readTimeResult = await db
            .select({ total: sql<number>`SUM(${readingProgress.totalReadDuration})` })
            .from(readingProgress)
            .where(
                and(
                    eq(readingProgress.studentId, studentId),
                    sql`${readingProgress.lastReadAt} >= ${date} AND ${readingProgress.lastReadAt} < ${nextDate}`
                )
            );

        // Get average quiz score on this date
        const quizScoreResult = await db
            .select({ avg: sql<number>`AVG(CAST(${quizAttempts.score} AS REAL) / ${quizAttempts.totalQuestions} * 100)` })
            .from(quizAttempts)
            .where(
                and(
                    eq(quizAttempts.studentId, studentId),
                    sql`${quizAttempts.completedAt} >= ${date} AND ${quizAttempts.completedAt} < ${nextDate}`
                )
            );

        // Get learning summary if it exists and was updated on or before this date
        const summaryResult = await db
            .select()
            .from(learningSummaries)
            .where(
                and(
                    eq(learningSummaries.studentId, studentId),
                    sql`${learningSummaries.lastUpdatedAt} <= ${nextDate}`
                )
            )
            .orderBy(sql`${learningSummaries.lastUpdatedAt} DESC`)
            .limit(1);

        return {
            modulesStarted: Number(modulesStartedResult[0]?.count || 0),
            modulesCompleted: Number(modulesCompletedResult[0]?.count || 0),
            timeWatched: Number(watchTimeResult[0]?.total || 0),
            timeRead: Number(readTimeResult[0]?.total || 0),
            avgQuizScore: Number(quizScoreResult[0]?.avg || 0),
            learningSummaryText: summaryResult[0]?.summaryText || null,
            learningSummaryProgressNote: summaryResult[0]?.progressNote || null,
            learningSummaryUpdatedAt: summaryResult[0]?.lastUpdatedAt || null,
        };
    }

    /**
     * Create daily snapshots for all students
     * Handles gap-filling: creates snapshots for all missing dates from last sync to yesterday
     */
    async createSnapshots(): Promise<number> {
        const db = getDatabase();
        const yesterday = this.getYesterday();

        // Get all students
        const allStudents = await db.select().from(students);

        if (allStudents.length === 0) {
            console.log('[DailySyncService] No students found, skipping snapshot creation');
            return 0;
        }

        // Get last snapshot date
        const lastSnapshotDate = await this.getLastSnapshotDate();

        // Determine date range to fill
        let startDate: string;
        if (!lastSnapshotDate) {
            // First time: only create yesterday's snapshot (no historical data)
            startDate = yesterday;
            console.log('[DailySyncService] First sync: creating snapshot for yesterday only');
        } else {
            // Fill gaps from day after last snapshot to yesterday
            const lastDate = new Date(lastSnapshotDate);
            lastDate.setDate(lastDate.getDate() + 1);
            startDate = lastDate.toISOString().split('T')[0];
            console.log(`[DailySyncService] Gap-filling: ${startDate} to ${yesterday}`);
        }

        // Generate date range
        const datesToProcess = this.generateDateRange(startDate, yesterday);

        if (datesToProcess.length === 0) {
            console.log('[DailySyncService] No missing dates to process');
            return 0;
        }

        console.log(`[DailySyncService] Creating ${datesToProcess.length} snapshots for ${allStudents.length} students`);

        let snapshotsCreated = 0;

        // Create snapshots for each student for each date
        for (const student of allStudents) {
            for (const date of datesToProcess) {
                // Check if snapshot already exists
                const existing = await db
                    .select()
                    .from(dailySyncSnapshots)
                    .where(
                        and(
                            eq(dailySyncSnapshots.studentId, student.id),
                            eq(dailySyncSnapshots.snapshotDate, date)
                        )
                    )
                    .limit(1);

                if (existing.length > 0) {
                    console.log(`[DailySyncService] Snapshot already exists for student ${student.id} on ${date}, skipping`);
                    continue;
                }

                // Calculate metrics
                const metrics = await this.calculateMetricsForDate(student.id, date);

                // Create snapshot
                const snapshot: NewDailySyncSnapshot = {
                    id: uuidv4(),
                    studentId: student.id,
                    snapshotDate: date,
                    modulesStarted: metrics.modulesStarted,
                    modulesCompleted: metrics.modulesCompleted,
                    timeWatched: metrics.timeWatched,
                    timeRead: metrics.timeRead,
                    avgQuizScore: metrics.avgQuizScore,
                    learningSummaryText: metrics.learningSummaryText,
                    learningSummaryProgressNote: metrics.learningSummaryProgressNote,
                    learningSummaryUpdatedAt: metrics.learningSummaryUpdatedAt,
                    synced: false,
                    createdAt: new Date().toISOString(),
                };

                await db.insert(dailySyncSnapshots).values(snapshot);
                snapshotsCreated++;
            }
        }

        console.log(`[DailySyncService] Created ${snapshotsCreated} snapshots`);
        return snapshotsCreated;
    }

    /**
     * Get all unsynced snapshots
     */
    async getUnsyncedSnapshots(): Promise<DailySyncSnapshot[]> {
        const db = getDatabase();

        const unsynced = await db
            .select()
            .from(dailySyncSnapshots)
            .where(eq(dailySyncSnapshots.synced, false))
            .orderBy(dailySyncSnapshots.snapshotDate);

        return unsynced;
    }

    /**
     * Mark snapshots as synced
     */
    async markAsSynced(snapshotIds: string[]): Promise<void> {
        const db = getDatabase();

        for (const id of snapshotIds) {
            await db
                .update(dailySyncSnapshots)
                .set({ synced: true })
                .where(eq(dailySyncSnapshots.id, id));
        }

        console.log(`[DailySyncService] Marked ${snapshotIds.length} snapshots as synced`);
    }
}
