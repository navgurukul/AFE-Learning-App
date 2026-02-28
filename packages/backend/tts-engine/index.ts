import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// When running inside the desktop app, init() sets this; otherwise use package dir
let packageRoot = path.resolve(__dirname, "..");

// Persistent daemon process
let daemonProcess: ChildProcess | null = null;
let daemonOutputDir: string | null = null;
let daemonReady = false;
let daemonEnv: NodeJS.ProcessEnv = {};

function getModelPath(): string {
    // Look for any .onnx voice model file
    const files = fs.readdirSync(packageRoot).filter(f => f.endsWith(".onnx"));
    if (files.length > 0) return path.join(packageRoot, files[0]);
    return path.join(packageRoot, "en_US-lessac-medium.onnx");
}

function getConfigPath(modelPath: string): string | null {
    // 1. Try conventional <model>.onnx.json
    const conventionalConfig = modelPath + ".json";
    if (fs.existsSync(conventionalConfig)) return conventionalConfig;

    // 2. Fallback: find any JSON file that looks like a Piper voice config
    const jsonFiles = fs.readdirSync(packageRoot).filter(f =>
        f.endsWith(".json") && f !== "package.json" && f !== "tsconfig.json"
    );
    if (jsonFiles.length > 0) return path.join(packageRoot, jsonFiles[0]);

    return null;
}

function getPiperBin(): string {
    const ext = process.platform === "win32" ? ".exe" : "";
    const bin = path.join(packageRoot, `piper${ext}`);
    return bin;
}

/**
 * Set the directory containing piper binary and voice model.
 * Call this from the Electron main process.
 */
export function init(ttsRoot: string): void {
    packageRoot = path.resolve(ttsRoot);
    console.log("[TTS] Initialized with root:", packageRoot);
}

/**
 * Check if Piper TTS is available (binary + model exist)
 */
export function isAvailable(): boolean {
    const bin = getPiperBin();
    const model = getModelPath();
    const binExists = fs.existsSync(bin);
    const modelExists = fs.existsSync(model);
    console.log(`[TTS] Available check: bin=${binExists} (${bin}), model=${modelExists} (${model})`);
    return binExists && modelExists;
}

/**
 * Build the shared environment for the Piper process.
 */
function buildEnv(): NodeJS.ProcessEnv {
    let env: NodeJS.ProcessEnv = { ...process.env };
    if (process.platform === "win32") {
        const pathEnv = process.env.PATH || "";
        env.PATH = [packageRoot, pathEnv].filter(Boolean).join(path.delimiter);
    } else {
        const libPath = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH";
        const existing = process.env[libPath] || "";
        env[libPath] = [packageRoot, existing].filter(Boolean).join(path.delimiter);
    }
    const espeakDataPath = path.join(packageRoot, "espeak-ng-data");
    if (fs.existsSync(espeakDataPath)) {
        env.ESPEAK_DATA_PATH = espeakDataPath;
    }
    return env;
}

/**
 * Start the Piper daemon in --output_dir mode so the model is loaded only once.
 * Sentences are piped line-by-line and output WAVs appear in daemonOutputDir.
 */
function ensureDaemon(): boolean {
    if (daemonProcess && !daemonProcess.killed && daemonReady) {
        return true;
    }

    if (!isAvailable()) {
        return false;
    }

    // Create a persistent temp output directory for this session
    if (!daemonOutputDir) {
        daemonOutputDir = path.join(os.tmpdir(), `piper-daemon-${crypto.randomUUID()}`);
        fs.mkdirSync(daemonOutputDir, { recursive: true });
    }

    const piperBin = getPiperBin();
    const modelPath = getModelPath();
    const configPath = getConfigPath(modelPath);
    const espeakDataPath = path.join(packageRoot, "espeak-ng-data");

    const piperArgs: string[] = [
        "--model", modelPath,
        "--output_dir", daemonOutputDir,
        "--length_scale", "0.9",   // 10% faster speech
    ];

    if (configPath) {
        piperArgs.push("--config", configPath);
    }
    if (fs.existsSync(espeakDataPath)) {
        piperArgs.push("--espeak_data", espeakDataPath);
    }

    daemonEnv = buildEnv();

    console.log("[TTS] Starting Piper daemon...");
    try {
        daemonProcess = spawn(piperBin, piperArgs, {
            env: daemonEnv,
            stdio: ["pipe", "pipe", "pipe"],
        });

        daemonProcess.stderr?.on("data", (data: Buffer) => {
            const msg = data.toString();
            // Piper logs to stderr; suppress noise but log errors
            if (msg.toLowerCase().includes("error")) {
                console.error("[TTS] Piper daemon stderr:", msg.trim());
            }
        });

        daemonProcess.on("exit", (code) => {
            console.warn(`[TTS] Piper daemon exited with code ${code}. Will restart on next call.`);
            daemonProcess = null;
            daemonReady = false;
        });

        daemonProcess.on("error", (err) => {
            console.error("[TTS] Piper daemon error:", err.message);
            daemonProcess = null;
            daemonReady = false;
        });

        daemonReady = true;
        console.log("[TTS] Piper daemon started, output dir:", daemonOutputDir);
        return true;
    } catch (err) {
        console.error("[TTS] Failed to start Piper daemon:", err);
        daemonProcess = null;
        daemonReady = false;
        return false;
    }
}

/**
 * Wait for a file to appear on disk (polling).
 * Piper writes <lineIndex>.wav to the output dir when synthesis is done.
 */
function waitForFile(filePath: string, timeoutMs = 30000): Promise<boolean> {
    return new Promise((resolve) => {
        const started = Date.now();
        const interval = setInterval(() => {
            if (fs.existsSync(filePath)) {
                // Extra safety: wait briefly to ensure write is complete
                setTimeout(() => {
                    clearInterval(interval);
                    resolve(true);
                }, 50);
                return;
            }
            if (Date.now() - started > timeoutMs) {
                clearInterval(interval);
                console.warn("[TTS] Timeout waiting for Piper output:", filePath);
                resolve(false);
            }
        }, 30);
    });
}

// Global line counter for daemon — Piper names outputs 0.wav, 1.wav, 2.wav...
let lineCounter = 0;

/**
 * Synthesize speech from text using Piper TTS persistent daemon.
 * Returns a WAV buffer, or null if Piper is unavailable.
 */
export async function speak(text: string): Promise<Buffer | null> {
    if (!text || text.trim().length === 0) {
        console.warn("[TTS] Empty text, skipping.");
        return null;
    }

    const started = ensureDaemon();
    if (!started || !daemonProcess || !daemonProcess.stdin || !daemonOutputDir) {
        console.warn("[TTS] Piper daemon not available, falling back to OS TTS.");
        return null;
    }

    // Piper names output files sequentially: 0.wav, 1.wav, etc.
    const idx = lineCounter++;
    const expectedFile = path.join(daemonOutputDir, `${idx}.wav`);

    console.log(`[TTS] Synthesizing (line ${idx}): "${text.substring(0, 50)}..."`);

    // Write the text as a single line to stdin
    try {
        daemonProcess.stdin.write(text.replace(/\n/g, " ") + "\n");
    } catch (err) {
        console.error("[TTS] Failed to write to Piper stdin:", err);
        return null;
    }

    // Wait for Piper to produce the output file
    const appeared = await waitForFile(expectedFile);
    if (!appeared) {
        return null;
    }

    try {
        const wavBuffer = await fs.promises.readFile(expectedFile);
        await fs.promises.unlink(expectedFile).catch(() => { });
        console.log(`[TTS] Daemon generated WAV: ${wavBuffer.length} bytes`);
        return wavBuffer;
    } catch (readErr) {
        console.error("[TTS] Failed to read Piper WAV output:", readErr);
        return null;
    }
}

/**
 * Stop any active TTS synthesis and shut down the daemon.
 */
export function stop(): void {
    if (daemonProcess) {
        console.log("[TTS] Stopping Piper daemon.");
        try {
            daemonProcess.kill();
        } catch {
            // ignore
        }
        daemonProcess = null;
        daemonReady = false;
    }

    // Clean up output dir
    if (daemonOutputDir && fs.existsSync(daemonOutputDir)) {
        try {
            fs.rmSync(daemonOutputDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
        daemonOutputDir = null;
    }

    // Reset line counter for next session
    lineCounter = 0;
}
