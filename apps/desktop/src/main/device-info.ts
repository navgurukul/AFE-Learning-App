import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app, dialog, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DeviceInfo } from '@afe/shared';

const execAsync = promisify(exec);

// Re-export for convenience
export type { DeviceInfo };

export interface Config {
    ngoKey: string;
    partnerName?: string;
    schoolName?: string;
    schoolUdise?: string | null;
    state?: string;
    city?: string;
    district?: string;
    districtCode?: string;
    schoolType?: string;
    countryCode?: string;
    distributionChannelHostId?: string;
    setupCompleted?: boolean;
    locationPermissionStatus?: 'granted' | 'denied';
    historicalSyncCompleted?: boolean;
}

// Config file path
const CONFIG_PATH = app.isPackaged
    ? path.join(app.getPath('appData'), 'OfflineLearningApp', 'config.json')
    : path.join(process.cwd(), '../dev-data/config.json');

const RMS_DEVICE_INFO_PATH = 'C:\\System.ServiceData\\device_info.json';

const INVALID_SERIALS = new Set([
    'to be filled by o.e.m.',
    'default string',
    'none',
    'n/a',
    'not specified',
    'system serial number',
    '',
    'unknown',
    '0',
    '00000000',
    'ffffffff',
    'unknown-serial'
]);

function isValidSerial(s: string | null | undefined): boolean {
    if (!s) return false;
    const lower = s.trim().toLowerCase();
    return !INVALID_SERIALS.has(lower) && lower.length >= 4;
}

/**
 * Get device MAC address cross-platform using Node os module (Primary Source of Truth)
 */
export async function getMacAddress(): Promise<string> {
    try {
        // 1. Check RMS cached device_info.json first
        if (process.platform === 'win32' && fs.existsSync(RMS_DEVICE_INFO_PATH)) {
            try {
                const content = fs.readFileSync(RMS_DEVICE_INFO_PATH, 'utf-8');
                const rmsInfo = JSON.parse(content);
                if (rmsInfo && rmsInfo.macAddress && rmsInfo.macAddress !== 'Unknown') {
                    return rmsInfo.macAddress.replace(/-/g, ':').toLowerCase();
                }
            } catch (e) {}
        }

        // 2. Scan network interfaces
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const ifaces = interfaces[name];
            if (!ifaces) continue;

            for (const iface of ifaces) {
                // Skip internal (loopback) and virtual interfaces without MAC
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    return iface.mac.replace(/-/g, ':').toLowerCase();
                }
            }
        }
        return 'UNKNOWN-MAC';
    } catch (error) {
        console.error('[DeviceInfo] Failed to get MAC address:', error);
        return 'UNKNOWN-MAC';
    }
}

/**
 * Get device serial number cross-platform with RMS parity & multi-tier fallbacks
 */
export async function getSerialNumber(): Promise<string> {
    try {
        // 1. Check RMS cached device_info.json on Windows first
        if (process.platform === 'win32' && fs.existsSync(RMS_DEVICE_INFO_PATH)) {
            try {
                const content = fs.readFileSync(RMS_DEVICE_INFO_PATH, 'utf-8');
                const rmsInfo = JSON.parse(content);
                if (rmsInfo && isValidSerial(rmsInfo.serialNumber)) {
                    console.log('[DeviceInfo] Using RMS cached serial:', rmsInfo.serialNumber);
                    return rmsInfo.serialNumber;
                }
            } catch (e) {}
        }

        // 2. Platform-specific detection
        if (process.platform === 'win32') {
            let detectedSerial: string | null = null;

            // WMI via PowerShell (Win32_BIOS, Win32_BaseBoard, Win32_SystemEnclosure)
            const wmiCmds = [
                'Get-CimInstance -ClassName Win32_BIOS | Select-Object -ExpandProperty SerialNumber',
                'Get-WmiObject -Class Win32_BIOS | Select-Object -ExpandProperty SerialNumber',
                'Get-CimInstance -ClassName Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber',
                'Get-WmiObject -Class Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber',
                'Get-CimInstance -ClassName Win32_SystemEnclosure | Select-Object -ExpandProperty SerialNumber',
            ];

            for (const cmd of wmiCmds) {
                try {
                    const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`, { timeout: 5000 });
                    if (isValidSerial(stdout.trim())) {
                        detectedSerial = stdout.trim();
                        break;
                    }
                } catch (e) {}
            }

            // WMIC CLI fallback
            if (!detectedSerial) {
                try {
                    const { stdout } = await execAsync('wmic bios get serialnumber /value', { timeout: 5000 });
                    const match = stdout.match(/SerialNumber=(.+)/i);
                    if (match && isValidSerial(match[1].trim())) {
                        detectedSerial = match[1].trim();
                    }
                } catch (e) {}
            }

            // Registry BIOS fallback
            if (!detectedSerial) {
                const regKeys = [
                    'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS /v SystemSerialNumber',
                    'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS /v BaseBoardSerialNumber',
                ];
                for (const regKey of regKeys) {
                    try {
                        const { stdout } = await execAsync(`reg query "${regKey}"`, { timeout: 5000 });
                        const match = stdout.match(/REG_SZ\s+(.+)/i);
                        if (match && isValidSerial(match[1].trim())) {
                            detectedSerial = match[1].trim();
                            break;
                        }
                    } catch (e) {}
                }
            }

            // Windows Product ID fallback
            if (!detectedSerial) {
                try {
                    const { stdout } = await execAsync(
                        'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductId',
                        { timeout: 5000 }
                    );
                    const match = stdout.match(/ProductId\s+REG_SZ\s+(.+)/i);
                    if (match && isValidSerial(match[1].trim())) {
                        detectedSerial = `WIN-${match[1].trim()}`;
                    }
                } catch (e) {}
            }

            // Hardware hash fallback
            if (!detectedSerial) {
                try {
                    const mac = await getMacAddress();
                    if (mac && mac !== 'UNKNOWN-MAC') {
                        const hash = crypto.createHash('sha256').update(mac).digest('hex').slice(0, 8).toUpperCase();
                        detectedSerial = `FP-${hash}`;
                    }
                } catch (e) {}
            }

            // Final fallback: persist a generated UUID
            if (!detectedSerial) {
                const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
                detectedSerial = `NG-${uuid}`;
            }

            return detectedSerial;
        } else if (process.platform === 'darwin') {
            const { stdout } = await execAsync(
                "ioreg -l | grep IOPlatformSerialNumber | awk '{print $4}' | sed 's/\"//g'"
            );
            return stdout.trim() || 'UNKNOWN-SERIAL';
        } else if (process.platform === 'linux') {
            try {
                return fs.readFileSync('/sys/class/dmi/id/product_serial', 'utf8').trim();
            } catch (e) {
                const { stdout } = await execAsync('cat /var/lib/dbus/machine-id');
                return stdout.trim() || 'UNKNOWN-SERIAL';
            }
        }
        return 'UNKNOWN-SERIAL';
    } catch (error) {
        console.error('[DeviceInfo] Failed to get serial number:', error);
        return 'UNKNOWN-SERIAL';
    }
}

/**
 * Read config file
 */
export function readConfig(): Required<Config> {
    const defaultConfig: Required<Config> = {
        ngoKey: 'D3F41T-K37',
        partnerName: 'Sama Digital Foundation – 1',
        schoolName: 'sama',
        schoolUdise: null,
        state: '',
        city: '',
        district: '',
        districtCode: '',
        schoolType: 'Government School',
        countryCode: 'IN',
        distributionChannelHostId: 'Sama Platform 1',
        setupCompleted: false,
        locationPermissionStatus: 'granted',
        historicalSyncCompleted: false
    };

    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            console.warn(`[DeviceInfo] Config file not found at ${CONFIG_PATH}, creating with defaults`);
            writeConfig(defaultConfig);
            return defaultConfig;
        }

        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config: Config = JSON.parse(content);
        return {
            ngoKey: config.ngoKey || defaultConfig.ngoKey,
            partnerName: config.partnerName || defaultConfig.partnerName,
            schoolName: config.schoolName || defaultConfig.schoolName,
            schoolUdise: config.schoolUdise !== undefined ? config.schoolUdise : defaultConfig.schoolUdise,
            state: config.state !== undefined ? config.state : defaultConfig.state,
            city: config.city !== undefined ? config.city : defaultConfig.city,
            district: config.district !== undefined ? config.district : defaultConfig.district,
            districtCode: config.districtCode !== undefined ? config.districtCode : defaultConfig.districtCode,
            schoolType: config.schoolType || defaultConfig.schoolType,
            countryCode: config.countryCode || defaultConfig.countryCode,
            distributionChannelHostId: config.distributionChannelHostId || defaultConfig.distributionChannelHostId,
            setupCompleted: config.setupCompleted !== undefined ? config.setupCompleted : defaultConfig.setupCompleted,
            locationPermissionStatus: config.locationPermissionStatus || defaultConfig.locationPermissionStatus,
            historicalSyncCompleted: config.historicalSyncCompleted === true
        };
    } catch (error) {
        console.error('[DeviceInfo] Failed to read config:', error);
        return defaultConfig;
    }
}

/**
 * Write config file
 */
export function writeConfig(config: Partial<Config>): void {
    try {
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        let existing: Partial<Config> = {};
        if (fs.existsSync(CONFIG_PATH)) {
            try {
                existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            } catch (e) {}
        }

        const newConfig = { ...existing, ...config };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
        console.log(`[DeviceInfo] Config written to ${CONFIG_PATH}`);
    } catch (error) {
        console.error('[DeviceInfo] Failed to write config:', error);
    }
}

/**
 * Backward compatibility helper for writeNGOKey
 */
export function writeNGOKey(ngoKey: string): void {
    writeConfig({ ngoKey });
}

/**
 * Get complete device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const [serialNumber, macAddress] = await Promise.all([
        getSerialNumber(),
        getMacAddress(),
    ]);

    const config = readConfig();

    const deviceInfo: DeviceInfo = {
        serialNumber,
        macAddress,
        appVersion: app.getVersion(),
        partnerName: config.partnerName || 'Sama Digital Foundation – 1',
        countryCode: config.countryCode || 'IN',
        distributionChannelHostId: config.distributionChannelHostId || 'Sama Platform 1',
        ngoKey: config.ngoKey,
        schoolName: config.schoolName || 'sama',
        schoolUdise: config.schoolUdise || null,
        state: config.state,
        city: config.city,
        district: config.district,
        districtCode: config.districtCode,
        schoolType: config.schoolType || 'Government School'
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

/**
 * Prompts user for location permission once on install/first run
 */
export function checkLocationPermissionAndPrompt(parentWindow: BrowserWindow): void {
    try {
        const config = readConfig();
        
        // Only ask if locationPermissionStatus is not set in config.json
        const isPermissionUnset = !fs.existsSync(CONFIG_PATH) || (() => {
            try {
                const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
                const parsed = JSON.parse(content);
                return parsed.locationPermissionStatus === undefined;
            } catch (e) { return true; }
        })();

        if (isPermissionUnset) {
            console.log('[DeviceInfo] Location permission is unset. Prompting user...');
            const choice = dialog.showMessageBoxSync(parentWindow, {
                type: 'question',
                buttons: ['Allow', 'Deny'],
                defaultId: 0,
                cancelId: 1,
                title: 'Location Access Request',
                message: 'Allow Amazon Future Engineer App to access your location to automatically determine your State and District?',
                detail: 'This is only asked once. Location is resolved automatically when the app has network connectivity during sync, and stored locally for offline tracking.',
            });

            const status = choice === 0 ? 'granted' : 'denied';
            writeConfig({ locationPermissionStatus: status });
            console.log(`[DeviceInfo] Location permission status set to: ${status}`);
        }
    } catch (e) {
        console.error('[DeviceInfo] Failed to check/prompt location permission:', e);
    }
}

/**
 * Resolves location using a free IP geolocation API if permission is granted but location is empty.
 * Runs in the background when sync starts.
 */
export async function updateLocationFromIP(fetchFn: any): Promise<void> {
    try {
        const config = readConfig();
        if (config.locationPermissionStatus === 'granted' && (!config.state || !config.district)) {
            console.log('[DeviceInfo] Location permission is granted but state/district is empty. Fetching live location...');
            
            let state = '';
            let district = '';
            
            // Try ipinfo.io first (often more accurate)
            try {
                const response = await fetchFn('https://ipinfo.io/json');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.region && data.city) {
                        state = data.region;
                        district = data.city;
                        console.log(`[DeviceInfo] Resolved location via ipinfo.io: State="${state}", District="${district}"`);
                    }
                }
            } catch (err) {
                console.warn('[DeviceInfo] Failed to fetch from ipinfo.io, trying fallback:', err);
            }

            // Fallback to ip-api.com if ipinfo failed
            if (!state || !district) {
                try {
                    const response = await fetchFn('https://ip-api.com/json/');
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.status === 'success') {
                            state = data.regionName || '';
                            district = data.city || '';
                            console.log(`[DeviceInfo] Resolved location via ip-api.com fallback: State="${state}", District="${district}"`);
                        }
                    }
                } catch (err) {
                    console.error('[DeviceInfo] Fallback ip-api.com check failed:', err);
                }
            }

            if (state || district) {
                writeConfig({ state, district });
                console.log(`[DeviceInfo] Geolocation retrieved successfully: State="${state}", District="${district}"`);
            } else {
                console.warn('[DeviceInfo] Could not resolve geolocation from any provider.');
            }
        }
    } catch (error) {
        console.error('[DeviceInfo] Error during IP geolocation check:', error);
    }
}
