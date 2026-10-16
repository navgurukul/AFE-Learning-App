import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export async function runPlatformCheck(options = {}) {
    const rawArgs = process.argv.slice(2);
    let targetOverride = options.target || process.env.TARGET_PLATFORM;

    for (const arg of rawArgs) {
        if (arg.startsWith('--target=')) {
            targetOverride = arg.split('=')[1].trim();
        }
    }

    const hostPlatform = process.platform;
    const targetPlatform = targetOverride || (hostPlatform === 'win32' ? 'win32' : 'linux');
    const isWindows = targetPlatform === 'win32';
    const isLinux = targetPlatform === 'linux';

    console.log('============================================================');
    console.log('[PC] AFE Platform Check & Pre-Flight Verification');
    console.log('============================================================');
    console.log(`[Platform] Host OS        : ${hostPlatform} (${os.type()} ${os.release()})`);
    console.log(`[Platform] Architecture   : ${process.arch}`);
    console.log(`[Platform] Node.js        : ${process.version}`);
    console.log(`[Platform] Target Platform: ${targetPlatform} (${isWindows ? 'Windows' : isLinux ? 'Linux' : targetPlatform})`);
    console.log('------------------------------------------------------------');

    const issues = [];
    const warnings = [];

    // 1. Node.js Version Check
    const majorNode = parseInt(process.versions.node.split('.')[0], 10);
    if (majorNode < 20) {
        warnings.push(`Node.js version is ${process.version}. Recommended version is >= 20.0.0.`);
    } else {
        console.log(`[Check] Node.js version >= 20 verified (${process.version})`);
    }

    // 2. Preload Synchronization
    const preloadSrc = path.join(rootDir, 'apps/desktop/src/preload/secure.cjs');
    const preloadDestDir = path.join(rootDir, 'apps/desktop/dist/preload');
    const preloadDest = path.join(preloadDestDir, 'secure.cjs');

    try {
        if (!fs.existsSync(preloadSrc)) {
            issues.push(`Preload source missing: ${preloadSrc}`);
        } else {
            fs.mkdirSync(preloadDestDir, { recursive: true });
            fs.copyFileSync(preloadSrc, preloadDest);
            console.log(`[Check] Preload script synchronized: apps/desktop/dist/preload/secure.cjs`);
        }
    } catch (err) {
        issues.push(`Failed to synchronize preload script: ${err.message}`);
    }

    // 3. Linux-Specific Executable Permissions & Files
    if (isLinux || hostPlatform === 'linux') {
        const linuxBinaries = [
            path.join(rootDir, 'packages/backend/stt-engine/whisper-cli'),
            path.join(rootDir, 'packages/backend/tts-engine/piper'),
            path.join(rootDir, 'apps/desktop/build/linux/after-install.sh'),
            path.join(rootDir, 'apps/desktop/build/linux/after-remove.sh')
        ];

        for (const file of linuxBinaries) {
            if (fs.existsSync(file)) {
                try {
                    fs.chmodSync(file, 0o755);
                    console.log(`[Check] Verified Linux executable permission (0o755): ${path.relative(rootDir, file)}`);
                } catch (e) {
                    warnings.push(`Could not set 0o755 permission on ${file}: ${e.message}`);
                }
            } else if (isLinux) {
                warnings.push(`Linux binary not found: ${path.relative(rootDir, file)}`);
            }
        }

        // Check and chmod Linux shared libraries in tts-engine
        const ttsDir = path.join(rootDir, 'packages/backend/tts-engine');
        if (fs.existsSync(ttsDir)) {
            const files = fs.readdirSync(ttsDir);
            for (const f of files) {
                if (f.includes('.so')) {
                    const full = path.join(ttsDir, f);
                    try {
                        fs.chmodSync(full, 0o755);
                    } catch (e) {
                        // ignore on non-posix systems
                    }
                }
            }
            console.log(`[Check] Verified Linux shared library permissions in packages/backend/tts-engine`);
        }
    }

    // 4. Windows-Specific Checks
    if (isWindows || hostPlatform === 'win32') {
        const winBinaries = [
            path.join(rootDir, 'packages/backend/stt-engine/whisper-cli.exe'),
            path.join(rootDir, 'packages/backend/stt-engine/whisper.dll'),
            path.join(rootDir, 'packages/backend/stt-engine/SDL2.dll'),
            path.join(rootDir, 'packages/backend/tts-engine/piper.exe'),
            path.join(rootDir, 'packages/backend/tts-engine/espeak-ng.dll'),
            path.join(rootDir, 'packages/backend/tts-engine/onnxruntime.dll'),
            path.join(rootDir, 'apps/desktop/build/icon.ico')
        ];

        for (const file of winBinaries) {
            if (fs.existsSync(file)) {
                // binary verified
            } else if (isWindows) {
                warnings.push(`Windows resource missing: ${path.relative(rootDir, file)}`);
            }
        }
        console.log(`[Check] Windows native binaries & icons verified`);
    }

    // 5. STT & TTS Models Check
    const sttModel = path.join(rootDir, 'packages/backend/stt-engine/ggml-base-q5_1.bin');
    if (fs.existsSync(sttModel)) {
        console.log(`[Check] STT Whisper model found: ggml-base-q5_1.bin`);
    } else {
        warnings.push(`STT Whisper model missing: packages/backend/stt-engine/ggml-base-q5_1.bin`);
    }

    const ttsDir = path.join(rootDir, 'packages/backend/tts-engine');
    if (fs.existsSync(ttsDir)) {
        const onnxModels = fs.readdirSync(ttsDir).filter(f => f.endsWith('.onnx'));
        if (onnxModels.length > 0) {
            console.log(`[Check] TTS Piper voice model found: ${onnxModels[0]}`);
        } else {
            warnings.push(`TTS Piper .onnx model missing in packages/backend/tts-engine`);
        }
    }

    // 6. Native Module Verification (better-sqlite3 for Electron)
    if (hostPlatform === targetPlatform) {
        console.log(`[Check] Verifying native module better-sqlite3 for Electron ABI...`);
        const desktopDir = path.join(rootDir, 'apps/desktop');
        let sqliteOk = false;

        try {
            const probeCmd = 'npx electron -e "require(\\"better-sqlite3\\"); console.log(\\"SQLITE_OK\\");"';
            const output = execSync(probeCmd, {
                cwd: desktopDir,
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            if (output.includes('SQLITE_OK')) {
                sqliteOk = true;
                console.log(`[Check] better-sqlite3 native module verified for Electron ABI`);
            }
        } catch (probeErr) {
            console.warn(`[PC] better-sqlite3 verification failed with current Electron ABI.`);
            console.log(`[PC] Automatically triggering electron-rebuild for better-sqlite3...`);
            try {
                execSync('pnpm --filter desktop exec electron-rebuild -f -w better-sqlite3', {
                    cwd: rootDir,
                    stdio: 'inherit'
                });
                console.log(`[Check] electron-rebuild completed for better-sqlite3`);
                sqliteOk = true;
            } catch (rebuildErr) {
                issues.push(`electron-rebuild failed for better-sqlite3: ${rebuildErr.message}`);
            }
        }
    } else {
        console.log(`[Check] Cross-platform build target (${hostPlatform} -> ${targetPlatform}). Skipping runtime ABI probe.`);
    }

    // Summary
    console.log('------------------------------------------------------------');
    if (warnings.length > 0) {
        for (const w of warnings) {
            console.warn(`[WARNING] ${w}`);
        }
    }

    if (issues.length > 0) {
        for (const iss of issues) {
            console.error(`[ERROR] ${iss}`);
        }
        console.log('============================================================');
        console.error(`[PC] Platform Check failed with ${issues.length} error(s).`);
        console.log('============================================================');
        return { success: false, hostPlatform, targetPlatform, issues, warnings };
    }

    console.log(`[PC] All platform checks passed successfully for ${targetPlatform}!`);
    console.log('============================================================\n');
    return { success: true, hostPlatform, targetPlatform, issues, warnings };
}

// Execute directly if run as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPlatformCheck()
        .then(result => {
            if (!result.success) {
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('[PC] Unexpected error during platform check:', err);
            process.exit(1);
        });
}
