import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DeviceInfo } from '@afe/shared';

const execAsync = promisify(exec);

// Re-export for convenience
export type { DeviceInfo };

export interface Config {
    ngoKey: string;
}

// Config file path
const CONFIG_PATH = app.isPackaged
    ? path.join(app.getPath('appData'), 'OfflineLearningApp', 'config.json')
    : path.join(process.cwd(), '../dev-data/config.json');

/**
 * Get Windows serial number using WMIC
 */
async function getSerialNumber(): Promise<string> {
    try {
        const { stdout } = await execAsync('wmic bios get serialnumber');
        const lines = stdout.trim().split('\n');
        // Skip header line, take first data line
        const serial = lines[1]?.trim() || 'UNKNOWN-SERIAL';
        return serial;
    } catch (error) {
        console.error('[DeviceInfo] Failed to get serial number:', error);
        return 'UNKNOWN-SERIAL';
    }
}

/**
 * Get MAC address of the first active network adapter
 */
async function getMacAddress(): Promise<string> {
    try {
        const { stdout } = await execAsync('getmac /fo csv /nh');
        const lines = stdout.trim().split('\n');
        // Parse CSV: "Name","MAC Address"
        const firstLine = lines[0];
        if (firstLine) {
            // Extract MAC from CSV format
            const match = firstLine.match(/\"([^\"]+)\",\"([^\"]+)\"/);
            if (match && match[2]) {
                return match[2].replace(/-/g, ':');
            }
        }
        return 'UNKNOWN-MAC';
    } catch (error) {
        console.error('[DeviceInfo] Failed to get MAC address:', error);
        return 'UNKNOWN-MAC';
    }
}

/**
 * Read NGO key from config file
 */
function readNGOKey(): string {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            console.warn(`[DeviceInfo] Config file not found at ${CONFIG_PATH}, using default`);
            return 'D3F41T-K37';
        }

        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config: Config = JSON.parse(content);
        return config.ngoKey || 'D3F41T-K37';
    } catch (error) {
        console.error('[DeviceInfo] Failed to read NGO key:', error);
        return 'D3F41T-K37';
    }
}

/**
 * Write NGO key to config file
 */
export function writeNGOKey(ngoKey: string): void {
    try {
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const config: Config = { ngoKey };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`[DeviceInfo] NGO key written to ${CONFIG_PATH}`);
    } catch (error) {
        console.error('[DeviceInfo] Failed to write NGO key:', error);
    }
}

/**
 * Get complete device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const [serialNumber, macAddress] = await Promise.all([
        getSerialNumber(),
        getMacAddress(),
    ]);

    const ngoKey = readNGOKey();

    const deviceInfo: DeviceInfo = {
        serialNumber,
        macAddress,
        ngoKey,
    };

    console.log('[DeviceInfo] Device fingerprint:', deviceInfo);
    return deviceInfo;
}

/**
 * Check if config exists
 */
export function hasConfig(): boolean {
    return fs.existsSync(CONFIG_PATH);
}
