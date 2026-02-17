import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// Using __dirname as this package builds to CommonJS
const currentDir = __dirname;

const MODEL_PATH = path.join(currentDir, "..", "ggml-small-q5_1.bin");
const WHISPER_BIN = path.join(currentDir, "..", "whisper-cli");

let audioBuffer: Buffer[] = [];

export function pushAudioChunk(chunk: Buffer) {
    audioBuffer.push(chunk);
}

function createWavFile(pcmData: Buffer, sampleRate: number) {
    const header = Buffer.alloc(44);
    const fileSize = 36 + pcmData.length;

    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}

export async function processAudio(): Promise<string | null> {
    if (audioBuffer.length === 0) {
        console.log("[STT] No audio chunks to process.");
        return null;
    }

    console.log(`[STT] Processing audio... Buffer chunks: ${audioBuffer.length}`);
    const merged = Buffer.concat(audioBuffer);
    audioBuffer = [];

    const wavFile = createWavFile(merged, 16000);
    const tempFile = path.join(os.tmpdir(), "recording.wav");

    await fs.promises.writeFile(tempFile, wavFile);
    console.log(`[STT] WAV file written to: ${tempFile}`);

    return new Promise((resolve) => {
        console.log(`[STT] Executing: ${WHISPER_BIN} -m ${MODEL_PATH} -f ${tempFile}`);
        execFile(
            WHISPER_BIN,
            [
                "-m", MODEL_PATH,
                "-f", tempFile,
                "--no-timestamps",
                "-otxt",
                "--threads", "4"
            ],
            (err, stdout, stderr) => {
                if (err) {
                    console.error(`[STT] Execution error: ${err.message}`);
                    if (stderr) console.error(`[STT] stderr: ${stderr}`);
                    resolve(null);
                    return;
                }

                if (!stdout) {
                    console.warn(`[STT] No output from whisper-cli`);
                    resolve(null);
                    return;
                }

                const result = stdout.trim();
                console.log(`[STT] Transcription result: "${result}"`);
                resolve(result);
            }
        );
    });
}

export function resetAudio() {
    audioBuffer = [];
}
