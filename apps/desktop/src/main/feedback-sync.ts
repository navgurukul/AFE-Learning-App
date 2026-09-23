import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { net, BrowserWindow } from 'electron';
import { PATHS, APP_DATA_ROOT } from './paths.js';
import {
    saveLocalFeedback,
    getUnsyncedFeedbacks,
    markFeedbackAsSynced,
    getLastUserFeedback,
    purgeAllDatabaseData,
    type LocalFeedback
} from '@backend/db';
import {
    getDeviceInfo,
    getEffectiveServerUrl,
    setDeveloperModeActive,
    isDeveloperModeActive
} from './device-info.js';
import { getSlicedLogs, purgeMainLogFile } from './log-slicer.js';
import { SessionManager } from './session-manager.js';
import { loadContentManifest } from '@backend/content-engine';
import { syncContentToDatabase } from './content-sync.js';

const FEEDBACK_DIR = path.join(APP_DATA_ROOT, 'feedbacks');

function ensureFeedbackDir() {
    if (!fs.existsSync(FEEDBACK_DIR)) {
        fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
    }
}

const RMS_API_KEY = process.env.RMS_API_KEY || 'rms_secure_api_key_2026';

function generateAuthHeaders(apiKey: string = RMS_API_KEY): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
        .createHmac('sha256', apiKey)
        .update(timestamp)
        .digest('hex');

    return {
        'X-API-Signature': signature,
        'X-Timestamp': timestamp
    };
}

/**
 * Upload a single feedback record to the target server
 */
async function uploadFeedbackPayload(
    serverUrl: string,
    payload: {
        serialNumber: string;
        schoolUdise: string;
        schoolName: string;
        message: string;
        feedbackType: string;
        isDevMode: boolean;
        screenshotPath?: string | null;
        logFilePath?: string | null;
    }
): Promise<boolean> {
    try {
        const authHeaders = generateAuthHeaders();
        const formData = new FormData();

        formData.append('serialNumber', payload.serialNumber || '');
        formData.append('schoolUdise', payload.schoolUdise || '');
        formData.append('schoolName', payload.schoolName || '');
        formData.append('message', payload.message || '');
        formData.append('feedbackType', payload.feedbackType || 'USER_FEEDBACK');
        formData.append('isDevMode', String(payload.isDevMode));

        if (payload.logFilePath && fs.existsSync(payload.logFilePath)) {
            const logBytes = fs.readFileSync(payload.logFilePath);
            const logName = path.basename(payload.logFilePath);
            const logBlob = new Blob([logBytes], { type: 'text/plain' });
            formData.append('log_file', logBlob, logName);
        }

        if (payload.screenshotPath && fs.existsSync(payload.screenshotPath)) {
            const scBytes = fs.readFileSync(payload.screenshotPath);
            const scName = path.basename(payload.screenshotPath);
            const scBlob = new Blob([scBytes], { type: 'image/png' });
            formData.append('screenshot', scBlob, scName);
        }

        const endpoint = `${serverUrl.replace(/\/+$/, '')}/feedback`;
        console.log(`[FeedbackSync] Uploading feedback to: ${endpoint}`);

        const response = await net.fetch(endpoint, {
            method: 'POST',
            headers: {
                ...authHeaders
            },
            body: formData as any
        });

        if (response.ok) {
            console.log(`✓ [FeedbackSync] Feedback uploaded successfully to ${endpoint}`);
            return true;
        } else {
            const errText = await response.text().catch(() => '');
            console.warn(`[FeedbackSync] Upload failed with status ${response.status}: ${errText}`);
            return false;
        }
    } catch (err) {
        console.warn('[FeedbackSync] Network error during feedback upload:', err);
        return false;
    }
}

/**
/**
 * Check if the machine is currently rate-limited (max 1 user feedback per hour)
 */
export async function checkFeedbackRateLimit(): Promise<{ allowed: boolean; remainingMinutes: number }> {
    try {
        const lastFb = await getLastUserFeedback();
        if (!lastFb || !lastFb.createdAt) {
            return { allowed: true, remainingMinutes: 0 };
        }
        const lastTime = new Date(lastFb.createdAt).getTime();
        const diffMinutes = Math.floor((Date.now() - lastTime) / (1000 * 60));
        if (diffMinutes < 60) {
            return { allowed: false, remainingMinutes: 60 - diffMinutes };
        }
    } catch (err) {
        console.warn('[FeedbackSync] Error checking rate limit:', err);
    }
    return { allowed: true, remainingMinutes: 0 };
}

/**
 * Submit feedback from the UI:
 * 1. Validates 1 feedback per machine per hour rate limit
 * 2. Slices 3-day logs
 * 3. Saves screenshot to disk if provided
 * 4. Saves to local SQLite DB (synced = false)
 * 5. Tries immediate upload if online
 * 6. ALWAYS returns success to UI (offline-first resilience)
 */
export async function submitFeedback(params: {
    message: string;
    screenshotBase64?: string;
    feedbackType?: string;
}): Promise<{ success: boolean; feedbackId: string; synced: boolean; message: string; rateLimited?: boolean }> {
    ensureFeedbackDir();

    const normalizedType = ['BUG', 'SUGGESTION', 'DEV_MODE_LOG'].includes(String(params.feedbackType).toUpperCase())
        ? String(params.feedbackType).toUpperCase()
        : 'BUG';

    // Enforce max 1 feedback per machine per hour for user submissions (BUG or SUGGESTION)
    if (normalizedType !== 'DEV_MODE_LOG') {
        const rateCheck = await checkFeedbackRateLimit();
        if (!rateCheck.allowed) {
            console.warn(`[FeedbackSync] Rate limit active: ${rateCheck.remainingMinutes} minutes remaining`);
            return {
                success: false,
                feedbackId: '',
                synced: false,
                rateLimited: true,
                message: `Only 1 feedback per hour can be submitted from this machine. Please wait ${rateCheck.remainingMinutes} more minute${rateCheck.remainingMinutes > 1 ? 's' : ''}.`
            };
        }
    }

    const deviceInfo = await getDeviceInfo();
    const serialNumber = deviceInfo.serialNumber || 'UNKNOWN_SERIAL';
    const schoolUdise = deviceInfo.schoolUdise || 'NO_UDISE';
    const schoolName = deviceInfo.schoolName || '';
    const isDev = isDeveloperModeActive();
    const feedbackType = normalizedType;
    const feedbackId = crypto.randomUUID();

    // 1. Slice logs
    const logSlice = getSlicedLogs(serialNumber, schoolUdise);
    const localLogPath = path.join(FEEDBACK_DIR, logSlice.logFileName);
    fs.writeFileSync(localLogPath, logSlice.content, 'utf8');

    // 2. Save screenshot if attached
    let localScreenshotPath: string | null = null;
    if (params.screenshotBase64) {
        try {
            const base64Data = params.screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
            const scBuffer = Buffer.from(base64Data, 'base64');
            const scName = logSlice.logFileName.replace(/\.log$/i, '_screenshot.png');
            localScreenshotPath = path.join(FEEDBACK_DIR, scName);
            fs.writeFileSync(localScreenshotPath, scBuffer);
        } catch (e) {
            console.error('[FeedbackSync] Failed to decode and save screenshot:', e);
        }
    }

    // 3. Save to local SQLite database with synced = false
    await saveLocalFeedback({
        id: feedbackId,
        serialNumber,
        schoolUdise,
        schoolName,
        message: params.message || '',
        feedbackType,
        screenshotPath: localScreenshotPath,
        logFilePath: localLogPath,
        synced: false,
        isDevMode: isDev,
        createdAt: new Date().toISOString()
    });

    console.log(`[FeedbackSync] Feedback ${feedbackId} saved to local SQLite DB`);

    // 4. Attempt immediate upload in background
    let synced = false;
    const serverUrl = getEffectiveServerUrl();

    try {
        const uploaded = await uploadFeedbackPayload(serverUrl, {
            serialNumber,
            schoolUdise,
            schoolName,
            message: params.message,
            feedbackType,
            isDevMode: isDev,
            screenshotPath: localScreenshotPath,
            logFilePath: localLogPath
        });

        if (uploaded) {
            synced = true;
            await markFeedbackAsSynced(feedbackId);

            // Clean up temporary local files once synced
            try {
                if (localLogPath && fs.existsSync(localLogPath)) fs.unlinkSync(localLogPath);
                if (localScreenshotPath && fs.existsSync(localScreenshotPath)) fs.unlinkSync(localScreenshotPath);
            } catch {}
        }
    } catch (uploadErr) {
        console.warn('[FeedbackSync] Immediate upload skipped or failed (will sync later):', uploadErr);
    }

    // 5. ALWAYS return success for offline resilience
    return {
        success: true,
        feedbackId,
        synced,
        message: 'Feedback submitted successfully'
    };
}

/**
 * Flush all unsynced feedbacks from SQLite to the server
 */
export async function flushUnsyncedFeedbacks(): Promise<number> {
    const unsynced = await getUnsyncedFeedbacks();
    if (unsynced.length === 0) return 0;

    let syncedCount = 0;
    const serverUrl = getEffectiveServerUrl();

    for (const fb of unsynced) {
        try {
            const ok = await uploadFeedbackPayload(serverUrl, {
                serialNumber: fb.serialNumber || '',
                schoolUdise: fb.schoolUdise || '',
                schoolName: fb.schoolName || '',
                message: fb.message || '',
                feedbackType: fb.feedbackType,
                isDevMode: fb.isDevMode,
                screenshotPath: fb.screenshotPath,
                logFilePath: fb.logFilePath
            });

            if (ok) {
                await markFeedbackAsSynced(fb.id);
                syncedCount++;

                // Clean up local temp files
                try {
                    if (fb.logFilePath && fs.existsSync(fb.logFilePath)) fs.unlinkSync(fb.logFilePath);
                    if (fb.screenshotPath && fs.existsSync(fb.screenshotPath)) fs.unlinkSync(fb.screenshotPath);
                } catch {}
            }
        } catch (err) {
            console.error(`[FeedbackSync] Failed to sync feedback ${fb.id}:`, err);
        }
    }

    if (syncedCount > 0) {
        console.log(`✓ [FeedbackSync] Flushed ${syncedCount}/${unsynced.length} unsynced feedbacks to ${serverUrl}`);
    }
    return syncedCount;
}

/**
 * Turn off developer mode:
 * 1. Slices and sends the dev mode log file to the dev server
 * 2. Purges the main log file (clean slate)
 * 3. Purges all SQLite DB data
 * 4. Cleans internal managed state (SessionManager)
 * 5. Re-syncs content manifest so courses are ready
 * 6. Sets isDeveloperMode = false
 */
export async function turnOffDevModeAndPurge(mainWindow?: BrowserWindow | null): Promise<void> {
    console.log('🧹 [DevMode] Turning off Developer Mode and purging all data...');

    const deviceInfo = await getDeviceInfo();
    const serialNumber = deviceInfo.serialNumber || 'UNKNOWN_SERIAL';
    const schoolUdise = deviceInfo.schoolUdise || 'NO_UDISE';
    const devServerUrl = (process.env.CENTRALIZED_DEV_SERVER_URL || 'https://rms-api.thesama.in/api/afe').replace(/\/+$/, '');

    // 1. Slice and send dev mode log file
    try {
        const logSlice = getSlicedLogs(serialNumber, schoolUdise);
        ensureFeedbackDir();
        const tempLogPath = path.join(FEEDBACK_DIR, logSlice.logFileName);
        fs.writeFileSync(tempLogPath, logSlice.content, 'utf8');

        console.log(`[DevMode] Sending Dev Mode logs to ${devServerUrl}...`);
        await uploadFeedbackPayload(devServerUrl, {
            serialNumber,
            schoolUdise,
            schoolName: deviceInfo.schoolName || '',
            message: 'Developer mode turned off. Dev logs submitted.',
            feedbackType: 'DEV_MODE_EXIT',
            isDevMode: true,
            logFilePath: tempLogPath
        });

        if (fs.existsSync(tempLogPath)) {
            fs.unlinkSync(tempLogPath);
        }
    } catch (e) {
        console.error('[DevMode] Error sending dev mode logs before purge:', e);
    }

    // 2. PURGE main log file
    purgeMainLogFile();

    // 3. PURGE all SQLite DB data
    try {
        await purgeAllDatabaseData();
        console.log('✓ [DevMode] SQLite database purged.');
    } catch (e) {
        console.error('[DevMode] Error purging SQLite DB:', e);
    }

    // 4. Reset internal managed session state
    SessionManager.clear();
    console.log('✓ [DevMode] SessionManager reset.');

    // 5. Re-sync content manifest so lessons/modules are restored to fresh state
    try {
        const manifest = loadContentManifest(APP_DATA_ROOT);
        await syncContentToDatabase(manifest);
        console.log('✓ [DevMode] Content manifest re-synced to clean DB.');
    } catch (e) {
        console.warn('[DevMode] Warning re-syncing content manifest:', e);
    }

    // 6. Turn off developer mode in config
    setDeveloperModeActive(false);

    // 7. Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dev:status-changed', { isDevMode: false });
    }
}
