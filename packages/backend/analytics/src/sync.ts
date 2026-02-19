import { getDatabase, dailySyncSnapshots, students, eq } from '@backend/db';
import type { DeviceInfo } from '@afe/shared';
import type { DailySyncSnapshot } from '@backend/db';

export class SyncService {
    private serverUrl: string;
    private fetchFn: any;

    constructor(serverUrl: string, fetchFn: any) {
        this.serverUrl = serverUrl;
        this.fetchFn = fetchFn;
    }

    /**
     * Validate NGO key with RMS server
     */
    async validateNGOKey(ngoKey: string): Promise<{ valid: boolean; ngoId?: number; ngoName?: string; error?: string }> {
        try {
            const response = await this.fetchFn(`${this.serverUrl}/validate-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ngoKey })
            });

            if (!response.ok) {
                return { valid: false, error: `Server responded with ${response.status}` };
            }

            return await response.json();
        } catch (error) {
            console.error('[SyncService] NGO key validation failed:', error);
            return { valid: false, error: String(error) };
        }
    }

    /**
     * Sync all unsynced snapshots to RMS server
     */
    async syncToServer(deviceInfo: DeviceInfo): Promise<{ success: boolean; syncedCount: number }> {
        try {
            const db = getDatabase();

            // Get all unsynced snapshots
            const unsyncedSnapshots = await db
                .select()
                .from(dailySyncSnapshots)
                .where(eq(dailySyncSnapshots.synced, false))
                .orderBy(dailySyncSnapshots.snapshotDate);

            if (unsyncedSnapshots.length === 0) {
                console.log('[SyncService] No unsynced snapshots found');
                return { success: true, syncedCount: 0 };
            }

            console.log(`[SyncService] Found ${unsyncedSnapshots.length} unsynced snapshots`);

            // Get student names (snapshots only have IDs)
            const studentMap = new Map<string, string>();
            const allStudents = await db.select().from(students);
            for (const student of allStudents) {
                studentMap.set(student.id, student.name);
            }

            // Build payload
            const payload = {
                ngoKey: deviceInfo.ngoKey,
                serialNumber: deviceInfo.serialNumber,
                macAddress: deviceInfo.macAddress,
                snapshots: unsyncedSnapshots.map(snap => ({
                    studentUuid: snap.studentId,
                    studentName: studentMap.get(snap.studentId) || 'Unknown',
                    snapshotDate: snap.snapshotDate,
                    modulesStarted: snap.modulesStarted,
                    modulesCompleted: snap.modulesCompleted,
                    timeWatched: snap.timeWatched,
                    timeRead: snap.timeRead,
                    avgQuizScore: snap.avgQuizScore,
                    learningSummary: snap.learningSummaryText ? {
                        text: snap.learningSummaryText,
                        progressNote: snap.learningSummaryProgressNote || null,
                        lastUpdatedAt: snap.learningSummaryUpdatedAt || null
                    } : null
                }))
            };

            // Send to server
            const response = await this.fetchFn(`${this.serverUrl}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`[SyncService] Server responded with ${response.status}: ${response.statusText}`);
                return { success: false, syncedCount: 0 };
            }

            const result = await response.json();

            // Mark snapshots as synced
            for (const snap of unsyncedSnapshots) {
                await db.update(dailySyncSnapshots)
                    .set({ synced: true })
                    .where(eq(dailySyncSnapshots.id, snap.id));
            }

            console.log(`[SyncService] Successfully synced ${unsyncedSnapshots.length} snapshots`);
            return { success: true, syncedCount: unsyncedSnapshots.length };
        } catch (error) {
            console.error('[SyncService] Sync failed:', error);
            return { success: false, syncedCount: 0 };
        }
    }
}

