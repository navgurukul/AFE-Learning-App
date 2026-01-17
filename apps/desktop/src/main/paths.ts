import { app } from 'electron';
import path from 'path';
import fs from 'fs';

console.log(app.isPackaged);
export const APP_DATA_ROOT = app.isPackaged
    ? 'C:\\ProgramData\\OfflineLearningApp'
    : path.join(process.cwd(), '../../dev-data');
console.log('APP_DATA_ROOT:', APP_DATA_ROOT);
export const PATHS = {
    // Root data directory
    ROOT: APP_DATA_ROOT,

    // Database
    DATABASE: path.join(APP_DATA_ROOT, 'data.db'),

    // Content
    CONTENT_DIR: path.join(APP_DATA_ROOT, 'content'),
    MANIFEST: path.join(APP_DATA_ROOT, 'content', 'manifest.json'),

    // Assets
    ASSETS_DIR: path.join(APP_DATA_ROOT, 'assets'),
    AVATARS_DIR: path.join(APP_DATA_ROOT, 'assets', 'avatars'),
    VIDEOS_DIR: path.join(APP_DATA_ROOT, 'assets', 'videos'),

    // Logs (optional)
    LOGS_DIR: path.join(APP_DATA_ROOT, 'logs'),
} as const;

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
    const dirs = [
        PATHS.ROOT,
        PATHS.CONTENT_DIR,
        PATHS.ASSETS_DIR,
        PATHS.AVATARS_DIR,
        PATHS.VIDEOS_DIR,
        PATHS.LOGS_DIR,
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✓ Created directory: ${dir}`);
        }
    }
}

/**
 * Check if content manifest exists
 */
export function hasContentManifest(): boolean {
    console.log(PATHS.MANIFEST);
    return fs.existsSync(PATHS.MANIFEST);
}

/**
 * Get database path for initialization
 */
export function getDatabasePath(): string {
    return PATHS.DATABASE;
}
