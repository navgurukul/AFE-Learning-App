import os from 'os';
import { execSync } from 'child_process';

let isLowEndMemo: boolean | null = null;

export function isLowEndDevice(): boolean {
    if (isLowEndMemo !== null) return isLowEndMemo;

    const totalRamGB = os.totalmem() / (1024 * 1024 * 1024);
    const is4GBOrLess = totalRamGB <= 4.5; // Catch 4GB devices which report ~3.8GB

    // Now check for GPU.
    let hasDedicatedGPU = false;
    let gpuInfo = "Unknown";
    try {
        if (process.platform === 'win32') {
            // wmic works synchronously to get video controllers on Windows
            const stdout = execSync('wmic path win32_VideoController get name', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            gpuInfo = stdout.trim().replace(/\r?\n|\r/g, ", ");
            const lowerOutput = gpuInfo.toLowerCase();
            
            // Typical dedicated GPUs: NVIDIA, RTX, GTX, Radeon RX
            // Typical integrated: Intel, UHD, HD Graphics, Microsoft Basic Display
            if (lowerOutput.includes('nvidia') || lowerOutput.includes('radeon rx') || lowerOutput.includes('geforce')) {
                hasDedicatedGPU = true;
            }
        }
        else if (process.platform === 'darwin') {
            const stdout = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            gpuInfo = stdout.trim();
            if (gpuInfo.toLowerCase().includes('amd radeon') || gpuInfo.toLowerCase().includes('nvidia')) {
                hasDedicatedGPU = true;
            }
        }
        else {
            // Linux
            try {
                const stdout = execSync('lspci 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
                const matchedLines = stdout.split('\n').filter(line => /vga|3d|display/i.test(line));
                if (matchedLines.length > 0) {
                    gpuInfo = matchedLines.join(', ').trim();
                    const lower = gpuInfo.toLowerCase();
                    if (lower.includes('nvidia') || lower.includes('radeon')) {
                        hasDedicatedGPU = true;
                    }
                }
            } catch {
                // Ignore errors if lspci is not available
            }
        }
    } catch {
        // Ignore errors in exec, default to no GPU
    }

    isLowEndMemo = is4GBOrLess && !hasDedicatedGPU;

    console.log(`[Hardware Detection] -------------------------`);
    console.log(`[Hardware Detection] Total RAM: ${totalRamGB.toFixed(2)} GB`);
    console.log(`[Hardware Detection] GPU Info: ${gpuInfo}`);
    console.log(`[Hardware Detection] Dedicated GPU: ${hasDedicatedGPU ? 'YES' : 'NO'}`);
    console.log(`[Hardware Detection] result (isLowEndDevice): ${isLowEndMemo}`);
    console.log(`[Hardware Detection] -------------------------`);

    return isLowEndMemo;
}
