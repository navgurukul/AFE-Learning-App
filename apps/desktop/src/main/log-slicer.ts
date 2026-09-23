import fs from 'fs';
import path from 'path';
import { PATHS } from './paths.js';

export interface SlicedLogResult {
    content: string;
    logFileName: string;
    targetStartDate: string;
    lineCount: number;
}

/**
 * Sanitize strings for safe filenames (replace slashes, colons, spaces)
 */
function sanitizeForFilename(val: string | null | undefined, fallback: string): string {
    if (!val) return fallback;
    const sanitized = String(val).trim().replace(/[\/\\:*?"<>| ]+/g, '-').replace(/^-+|-+$/g, '');
    return sanitized.length > 0 ? sanitized : fallback;
}

/**
 * Extracts logs starting from 00:00 of 3 days prior (i.e. -4 days range: 14th, 15th, 16th, 17th)
 * Naming convention: {serial_numer}_{DD-MM-YYYY-}_{SCHOOL_UDISE}_{TIMESTAMP}
 */
export function getSlicedLogs(serialNumber?: string, schoolUdise?: string): SlicedLogResult {
    const logFilePath = path.join(PATHS.LOGS_DIR, 'main.log');
    const now = new Date();

    // Target start date: 00:00:00 of 3 days before today (e.g. Sept 17 -> Sept 14 00:00:00.000)
    const targetStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 0, 0, 0, 0);

    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const timestamp = Date.now();

    const safeSerial = sanitizeForFilename(serialNumber, 'UNKNOWN_SERIAL');
    const safeUdise = sanitizeForFilename(schoolUdise, 'NO_UDISE');

    // Naming convention: {serial_numer}_{DD-MM-YYYY-}_{SCHOOL_UDISE}_{TIMESTAMP}.log
    const logFileName = `${safeSerial}_${dd}-${mm}-${yyyy}-_${safeUdise}_${timestamp}.log`;

    if (!fs.existsSync(logFilePath)) {
        return {
            content: `[${now.toISOString()}] [info] Log file not found at ${logFilePath}. Fresh session initialized.`,
            logFileName,
            targetStartDate: targetStart.toISOString(),
            lineCount: 1,
        };
    }

    try {
        const fileContent = fs.readFileSync(logFilePath, 'utf8');
        const lines = fileContent.split('\n');

        // Regex to parse electron-log timestamp: [YYYY-MM-DD HH:mm:ss.SSS]
        const timestampRegex = /^\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/;

        let startIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(timestampRegex);
            if (match) {
                const dateStr = `${match[1]}T${match[2]}`;
                const entryDate = new Date(dateStr);
                if (!isNaN(entryDate.getTime()) && entryDate >= targetStart) {
                    startIndex = i;
                    break;
                }
            }
        }

        let selectedLines: string[] = [];
        if (startIndex !== -1) {
            selectedLines = lines.slice(startIndex);
        } else {
            // If all logs in the file are newer than targetStart, take all lines
            // If all logs are older than targetStart, take empty or recent lines
            const lastLineWithDate = [...lines].reverse().find(l => timestampRegex.test(l));
            if (lastLineWithDate) {
                const match = lastLineWithDate.match(timestampRegex);
                const entryDate = match ? new Date(`${match[1]}T${match[2]}`) : null;
                if (entryDate && entryDate < targetStart) {
                    selectedLines = [];
                } else {
                    selectedLines = lines;
                }
            } else {
                selectedLines = lines;
            }
        }

        const content = selectedLines.join('\n');
        return {
            content,
            logFileName,
            targetStartDate: targetStart.toISOString(),
            lineCount: selectedLines.length,
        };
    } catch (err: any) {
        console.error('[LogSlicer] Failed to slice log file:', err);
        return {
            content: `[Error reading log file: ${err?.message || err}]`,
            logFileName,
            targetStartDate: targetStart.toISOString(),
            lineCount: 1,
        };
    }
}

/**
 * Purges the main log file to a clean slate.
 * Called when developer mode is turned off.
 */
export function purgeMainLogFile(): void {
    const logFilePath = path.join(PATHS.LOGS_DIR, 'main.log');
    try {
        if (fs.existsSync(logFilePath)) {
            fs.writeFileSync(logFilePath, `[${new Date().toISOString()}] [info] Log file purged for Clean Slate.\n`, 'utf8');
            console.log('🧹 [LogSlicer] main.log has been purged.');
        }
    } catch (err) {
        console.error('[LogSlicer] Failed to purge main.log:', err);
    }
}
