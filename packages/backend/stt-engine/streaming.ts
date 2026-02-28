import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { createWavFile } from "./wavWriter.js";

const MODEL_PATH = "./ggml-small-q5_1.bin";
const WHISPER_BIN = "./whisper-cli";

export class StreamingSTT {
  private audioChunks: Buffer[] = [];
  private previousText = "";
  private processing = false;
  private minChunkSize = 16000 * 2; // 1 sec audio

  pushChunk(chunk: Buffer) {
    this.audioChunks.push(chunk);
  }

  async process(): Promise<string | null> {
    if (this.processing) return null;
    if (this.audioChunks.length === 0) return null;
    const totalSize = this.audioChunks.reduce((acc, b) => acc + b.length, 0);

    if (totalSize < this.minChunkSize) return null;

    this.processing = true;

    const tempFile = path.join(os.tmpdir(), "live_audio.wav");

    const mergedPcm = Buffer.concat(this.audioChunks);
    this.audioChunks = []; // 🔥 important fix

    const wavFile = createWavFile(mergedPcm, 16000);
    fs.writeFileSync(tempFile, wavFile);

    return new Promise((resolve) => {
      execFile(
        WHISPER_BIN,
        [
          "-m", MODEL_PATH,
          "-f", tempFile,
          "-otxt",
          "--no-timestamps",
          "--threads", "2"
        ],
        (err, stdout) => {
          this.processing = false;

          if (err || !stdout) {
            resolve(null);
            return;
          }

          const text = stdout.trim();

          // Only send new text
          const delta = text.startsWith(this.previousText)
            ? text.slice(this.previousText.length)
            : text;

          this.previousText = text;

          resolve(delta);
        }
      );
    });
  }

  reset() {
    this.audioChunks = [];
    this.previousText = "";
  }
}
