# 🖥️ CPU & Resource Usage Analysis — AFE Learning App

## Your Stack at a Glance

| Process | What it does | Model / Binary | Size |
|---------|-------------|----------------|------|
| **Ollama** (qwen2.5:1.5b) | LLM inference (chat, voice AI, summaries, title gen) | `qwen2.5:1.5b` (~900MB VRAM/RAM) | ~1GB loaded |
| **Whisper** (whisper-cli) | Speech-to-Text | `ggml-base.en-q5_1.bin` (~57MB) | ~200MB RAM |
| **Piper** (piper binary) | Text-to-Speech | `en_US-lessac-medium.onnx` (~63MB) | ~150MB RAM |
| **Node/Electron** | App process, IPC, DB | — | ~100–200MB RAM |

---

## 📊 Estimated CPU Usage by Component

### 1. Ollama — `qwen2.5:1.5b` (THE BIGGEST CPU HOG)

| Scenario | CPU Usage | Duration |
|----------|-----------|----------|
| **Idle** (model loaded, no requests) | ~0% | Always |
| **Text chat** (single response) | **80–100%** (all cores) | 3–15 sec |
| **Voice mode** (streaming response) | **80–100%** (all cores) | 5–20 sec |
| **Title generation** (fire-and-forget) | **80–100%** (all cores) | 2–5 sec |
| **Learning summary** generation | **80–100%** (all cores) | 10–30 sec |

> [!IMPORTANT]
> Ollama is your **#1 CPU consumer**. During inference, it will pin all available CPU cores to 100% (or use GPU if available). On a CPU-only machine, qwen2.5:1.5b will saturate the processor for the entire generation time.

**Key concern in your code:**
- [generateSessionTitle()](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/ai-tutor/src/index.ts#27-54) runs as a **fire-and-forget** on the first message (`line 172` in ai-tutor). This means when a student's first message triggers a response, **two** Ollama requests run back-to-back (main response + title generation), doubling the CPU load.
- [generateLearningSummary()](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/ai-tutor/src/index.ts#431-497) fetches **all sessions** and last 50 messages, sending a large context to the model.

---

### 2. Whisper (STT) — `ggml-base.en-q5_1.bin`

| Scenario | CPU Usage | Duration |
|----------|-----------|----------|
| **Idle** (not recording) | **0%** | — |
| **Processing audio** (after PTT release) | **40–80%** (4 threads) | 1–5 sec |

> [!NOTE]
> Whisper is configured with `--threads 4` (line 142, stt-engine/index.ts). It only runs **on-demand** when the user stops recording (push-to-talk). It is **NOT** a persistent process — the binary is `execFile`'d each time, so there is zero idle cost.

**Key observation:** Your `ggml-base.en-q5_1.bin` is the **base** English-only quantized model — this is already one of the lightest options. Each invocation starts a fresh process, processes the WAV, and exits.

---

### 3. Piper (TTS) — `en_US-lessac-medium.onnx`

| Scenario | CPU Usage | Duration |
|----------|-----------|----------|
| **Idle** | **0%** | — |
| **Synthesizing one sentence** | **30–50%** (1–2 cores) | 0.5–2 sec |
| **Voice mode pipeline** (multiple sentences) | **30–50% per sentence** | Sequential |

> [!NOTE]
> Each `ttsSpeak()` call spawns a **new** Piper process via `execFile`. The 63MB ONNX model is loaded into RAM **every single time**. Your code (handlers.ts line 304–324) correctly serializes Piper calls to one at a time, preventing concurrent model loads.

**Key concern:** In voice mode, Ollama streams → sentences are extracted → each sentence spawns a Piper process. While Ollama is 100% CPU and Piper is 30–50%, they overlap:
- Ollama is generating sentence N+2 while Piper is synthesizing sentence N+1

---

### 4. Node / Electron

| Scenario | CPU Usage | RAM |
|----------|-----------|-----|
| **Idle app** | ~1–3% | 100–200MB |
| **Streaming chunks via IPC** | ~5–10% | same |
| **SQLite DB queries** | negligible | same |

This is not a concern.

---

## 🔥 Worst-Case Scenario: Voice Mode

When a student uses **voice mode**, ALL heavy processes overlap:

```
Timeline:
[Whisper: 40-80% CPU, 1-5s]  →  [Ollama: 80-100% CPU, 5-20s]  →  [Piper × N sentences: 30-50% each]
                                  ↑ Title gen may also run here!
```

**Peak CPU during voice mode:** Essentially **100%+ sustained** for 10–30 seconds, with Ollama dominating. On a low-end machine (dual-core), this will cause noticeable UI freezing.

---

## 💾 Total RAM Estimate

| Component | RAM Usage |
|-----------|-----------|
| Ollama (qwen2.5:1.5b model loaded) | ~900MB – 1.2GB |
| Whisper (only when running) | ~200MB (temporary) |
| Piper (only when running) | ~150MB (temporary) |
| Electron app | ~150MB |
| **Total idle** | **~1.1 – 1.4 GB** |
| **Total during voice mode** | **~1.5 – 1.8 GB** |

---

## 🚀 Optimization Strategies

### ⚡ Tier 1 — Quick Wins (No Architecture Changes)

#### 1. **Reduce Whisper threads from 4 → 2**
Whisper currently uses `--threads 4`. On a dual-core machine this saturates the CPU. Reducing to 2 threads makes it slightly slower but leaves CPU headroom.
```typescript
// stt-engine/index.ts, line 142
"--threads", "2"  // was "4"
```

#### 2. **Defer title generation**
Currently [generateSessionTitle()](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/ai-tutor/src/index.ts#27-54) fires immediately on the first message, competing with the main response. Delay it:
```typescript
// ai-tutor/index.ts, line 172
setTimeout(() => {
    generateSessionTitle(sessionId, message).then(...)
}, 5000); // Wait 5 seconds after response completes
```

#### 3. **Set Ollama thread limits**
Ollama can be configured to use fewer threads:
```bash
# Set before starting Ollama
set OLLAMA_NUM_THREADS=4
ollama serve
```
Or in models with `num_thread` parameter in the Modelfile. This prevents Ollama from saturating all CPU cores.

#### 4. **Add Piper `--length_scale` for faster synthesis**
A slightly faster speech rate reduces Piper CPU time:
```typescript
// tts-engine/index.ts, piperArgs
"--length_scale", "0.9"  // 10% faster speech
```

---

### ⚡ Tier 2 — Medium Effort (Code Changes)

#### 5. **Cache/reuse Piper process (persistent daemon)**
Instead of `execFile` spawning a new Piper for every sentence (loading the 63MB model each time), keep Piper alive as a long-running process and pipe text to its stdin:
```
Benefit: Eliminates ~0.5–1s model load per sentence
Impact: Dramatically faster TTS in voice mode
```

#### 6. **Use Whisper `tiny.en` model instead of `base.en`**
If transcription quality is acceptable:
- `ggml-tiny.en-q5_1.bin` is ~30MB vs ~57MB
- 2–3× faster inference
- Slightly lower accuracy (but fine for single sentences / commands)

#### 7. **Reduce chat history context**
Currently loading 20 messages for text chat and **50 for voice mode** (line 274). Reducing this for voice mode:
```typescript
// Voice mode needs less context
.limit(10)  // was 50
```
Smaller context = faster Ollama inference.

#### 8. **Use `qwen2.5:0.5b` for title generation**
Title generation only needs 3–5 words. Use the smallest possible model:
```typescript
model: 'qwen2.5:0.5b'  // for generateSessionTitle only
```

---

### ⚡ Tier 3 — Architecture Changes (High Effort, High Impact)

#### 9. **GPU offloading for Ollama**
If the device has an NVIDIA GPU (even a low-end one), Ollama can offload layers:
```bash
# Check GPU availability
ollama run qwen2.5:1.5b --verbose
```
Even partial GPU offload (e.g., 10 layers) dramatically reduces CPU usage.

#### 10. **Swap Piper for a WASM/Web Audio TTS**
The browser's built-in `speechSynthesis` API uses zero additional CPU compared to spawning Piper processes. Your code already has a fallback path for this (useVoiceMode.ts line 297). Consider using browser TTS as default and Piper as opt-in for better voice quality.

#### 11. **Use whisper.cpp server mode**
Instead of spawning a new whisper-cli process per utterance, run `whisper-server` as a persistent HTTP service. This keeps the model in RAM and avoids cold-start per invocation.

#### 12. **Process throttling / scheduling**
Implement a queue that prevents Ollama + Whisper + Piper from running simultaneously:
```typescript
const cpuQueue = new PQueue({ concurrency: 1 });
// All heavy CPU tasks go through this queue
```

---

## 📋 Priority Recommendation

| Priority | Optimization | Effort | Impact |
|----------|-------------|--------|--------|
| 🟢 1 | Defer title generation | 5 min | Medium — prevents 2 Ollama requests overlapping |
| 🟢 2 | Reduce voice history to 10 | 2 min | Medium — faster Ollama responses |
| 🟢 3 | Set `OLLAMA_NUM_THREADS=4` | 1 min | Medium — stops CPU saturation |
| 🟡 4 | Reduce Whisper threads to 2 | 1 min | Small — leaves CPU headroom |
| 🟡 5 | Use 0.5b for title gen | 5 min | Small — faster title gen |
| 🟡 6 | Persistent Piper process | 2 hrs | High — eliminates model reload per sentence |
| 🟠 7 | Switch to tiny.en Whisper | 30 min | Medium — faster STT |
| 🟠 8 | GPU offloading | Config | **Huge** — if GPU available |
| 🔴 9 | Whisper server mode | 3 hrs | Medium — avoids cold starts |
| 🔴 10 | Process throttling queue | 2 hrs | Medium — prevents resource contention |

---

> [!TIP]
> **For your specific deployment (educational kiosks/devices):** The top 3 quick wins (#1-3) can be implemented in 10 minutes and will noticeably improve responsiveness, especially in voice mode. The persistent Piper process (#6) is the single most impactful code change if voice mode is heavily used.
