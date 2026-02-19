// Shared types for AFE-RMS sync
export interface DeviceInfo {
    serialNumber: string;
    macAddress: string;
    ngoKey: string;
}

export interface SyncSnapshot {
    studentUuid: string;
    studentName: string;
    snapshotDate: string;
    modulesStarted: number;
    modulesCompleted: number;
    timeWatched: number;
    timeRead: number;
    avgQuizScore: number;
    learningSummary: {
        text: string;
        progressNote: string | null;
        lastUpdatedAt: string | null;
    } | null;
}

export interface SyncPayload {
    ngoKey: string;
    serialNumber: string;
    macAddress: string;
    snapshots: SyncSnapshot[];
}
