import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// Resolve from package root (parent of dist/) so model and binary are found when placed in stt-engine/
const packageRoot = path.resolve(__dirname, "..");
const MODEL_PATH = path.join(packageRoot, "ggml-small-q5_1.bin");
const WHISPER_BIN = path.join(
    packageRoot,
    process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli"
);

let audioBuffer: Buffer[] = [];

// =============================
// Push Audio Chunk
// =============================
export function pushAudioChunk(chunk: Buffer) {
    if (!chunk || chunk.length === 0) return;

    // Optional safety: prevent unbounded memory growth
    if (audioBuffer.length > 10000) {
        console.warn("[STT] Too many audio chunks. Resetting buffer.");
        audioBuffer = [];
        return;
    }

    audioBuffer.push(chunk);
}

// =============================
// Create WAV File
// =============================
function createWavFile(pcmData: Buffer, sampleRate: number) {
    const header = Buffer.alloc(44);
    const fileSize = 36 + pcmData.length;

    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
    header.writeUInt16LE(2, 32); // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    header.write("data", 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}

// =============================
// Process Audio (Push-to-Talk)
// =============================
export async function processAudio(): Promise<string | null> {
    console.log("[STT] Processing audio...");
    if (audioBuffer.length === 0) {
        console.log("[STT] No audio chunks to process.");
        return null;
    }

    if (!fs.existsSync(MODEL_PATH)) {
        console.error("[STT] Model file not found:", MODEL_PATH);
        return null;
    }

    if (!fs.existsSync(WHISPER_BIN)) {
        console.error("[STT] whisper-cli binary not found:", WHISPER_BIN);
        return null;
    }

    console.log(`[STT] Processing audio... Chunks: ${audioBuffer.length}`);

    const merged = Buffer.concat(audioBuffer);
    audioBuffer = [];

    if (merged.length === 0) {
        console.warn("[STT] Merged audio is empty.");
        return null;
    }

    const wavFile = createWavFile(merged, 16000);

    // Unique temp filename to avoid race condition
    const tempFile = path.join(
        os.tmpdir(),
        `recording-${crypto.randomUUID()}.wav`
    );

    try {
        await fs.promises.writeFile(tempFile, wavFile);
    } catch (err) {
        console.error("[STT] Failed to write temp WAV:", err);
        return null;
    }

    console.log(`[STT] Temp WAV created: ${tempFile}`);

    // So the binary finds its shared library: Linux/macOS use LD_LIBRARY_PATH/DYLD_LIBRARY_PATH;
    // Windows finds DLLs next to the .exe if we add packageRoot to PATH
    let env: NodeJS.ProcessEnv = { ...process.env };
    if (process.platform === "win32") {
        const pathEnv = process.env.PATH || "";
        env.PATH = [packageRoot, pathEnv].filter(Boolean).join(path.delimiter);
    } else {
        const libPath = process.platform === "darwin" ? "DYLD_LIBRARY_PATH" : "LD_LIBRARY_PATH";
        const existing = process.env[libPath] || "";
        env[libPath] = [packageRoot, existing].filter(Boolean).join(path.delimiter);
    }

    return new Promise((resolve) => {
        execFile(
            WHISPER_BIN,
            [
                "-m", MODEL_PATH,
                "-f", tempFile,
                "--no-timestamps",
                "--threads", "4"
            ],
            { maxBuffer: 10 * 1024 * 1024, env }, // 10MB stdout limit
            async (err, stdout, stderr) => {

                // Clean temp file always
                try {
                    await fs.promises.unlink(tempFile);
                } catch {
                    // ignore cleanup error
                }

                if (err) {
                    console.error("[STT] whisper-cli execution error:", err.message);
                    if (stderr) console.error("[STT] stderr:", stderr);
                    resolve(null);
                    return;
                }

                if (!stdout || stdout.trim().length === 0) {
                    console.warn("[STT] No transcription output.");
                    resolve(null);
                    return;
                }

                const result = stdout.trim();
                console.log(`[STT] Transcription: "${result}"`);
                resolve(result);
            }
        );
    });
}

// =============================
// Reset Audio
// =============================
export function resetAudio() {
    audioBuffer = [];
}
