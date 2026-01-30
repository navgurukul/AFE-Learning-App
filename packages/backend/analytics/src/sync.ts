import { getAnalyticsSummary } from './index.js';
import { getAllStudents, getDatabase, learningSummaries, desc, eq } from '@backend/db';

export class SyncService {
    private serverUrl: string;
    private fetchFn: any;

    constructor(serverUrl: string, fetchFn: any) {
        this.serverUrl = serverUrl;
        this.fetchFn = fetchFn;
    }

    /**
     * Sync all students data to the centralized server
     */
    async syncAllStudents(): Promise<void> {
        console.log('[SyncService] Starting synchronization...');
        const students = await getAllStudents();
        const db = getDatabase();

        for (const student of students) {
            try {
                // 1. Get analytics summary
                const summary = await getAnalyticsSummary(student.id);

                // 2. Get latest AI learning summary
                const latestAiSummaryResult = await db
                    .select()
                    .from(learningSummaries)
                    .where(eq(learningSummaries.studentId, student.id))
                    .orderBy(desc(learningSummaries.lastUpdatedAt))
                    .limit(1);

                const aiSummary = latestAiSummaryResult[0];

                // 3. Prepare payload
                const payload = {
                    uuid: student.id,
                    name: student.name,
                    modulesStarted: summary.modulesStarted,
                    timeWatched: summary.totalWatchTime,
                    timeRead: summary.totalReadTime,
                    modulesCompleted: summary.modulesCompleted,
                    avgQuizScore: summary.averageQuizScore,
                    learningSummary: aiSummary ? {
                        text: aiSummary.summaryText,
                        progressNote: aiSummary.progressNote,
                        lastUpdatedAt: aiSummary.lastUpdatedAt
                    } : null
                };

                // 4. Send to centralized server (upsert)
                const response = await this.fetchFn(this.serverUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log(`[SyncService] Successfully synced data for student ${student.name}`);
                } else {
                    console.error(`[SyncService] Failed to sync data for student ${student.name}: ${response.statusText}`);
                }
            } catch (error) {
                console.error(`[SyncService] Error syncing student ${student.name}:`, error);
            }
        }
        console.log('[SyncService] Synchronization complete');
    }
}
