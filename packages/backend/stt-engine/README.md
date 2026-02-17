# STT Engine (Speech-to-Text)

This package runs **Whisper** (via [whisper.cpp](https://github.com/ggerganov/whisper.cpp)) for push-to-talk transcription. You need to build or obtain the `whisper-cli` binary and its shared library, and place the model file here.

---

## What must be in this folder

| File | Linux | macOS | Windows |
|------|-------|-------|---------|
| Model | `ggml-small-q5_1.bin` | same | same |
| CLI | `whisper-cli` | `whisper-cli` | **`whisper-cli.exe`** |
| Library | `libwhisper.so` + `libwhisper.so.1` | `libwhisper.dylib` | Optional: DLL next to `.exe` (or use static build) |

The app sets library path (Linux/macOS) or PATH (Windows) so the binary finds libraries in this folder.

---

## Step-by-step setup (Linux)

### 1. Clone and build whisper.cpp

```bash
# Pick a directory outside this repo, e.g. your home or /tmp
cd ~
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
```

Build the **shared library** and the **command-line tool**:

```bash
mkdir build
cd build
cmake .. -DBUILD_SHARED_LIBS=ON
cmake --build . --config Release
```

After this you should have something like:

- `build/libwhisper.so` (or a versioned name)
- `build/bin/main` (the CLI; we’ll copy it as `whisper-cli`)

### 2. Copy files into this package

From the **root of the AFE-Learning-App repo**:

```bash
STT_ENGINE=packages/backend/stt-engine
WHISPER_BUILD=~/whisper.cpp/build   # or wherever you built

# CLI (rename to whisper-cli)
cp "$WHISPER_BUILD/bin/main" "$STT_ENGINE/whisper-cli"
chmod +x "$STT_ENGINE/whisper-cli"

# Shared library
cp "$WHISPER_BUILD/libwhisper.so" "$STT_ENGINE/"

# If the app looks for libwhisper.so.1, add a symlink
cd "$STT_ENGINE"
ln -sf libwhisper.so libwhisper.so.1
```

### 3. Model file (if you don’t have it)

The app expects **`ggml-small-q5_1.bin`** in this folder. If you don’t have it:

- Download from Hugging Face / whisper.cpp model links, or
- Use the script in whisper.cpp:

```bash
cd ~/whisper.cpp
bash ./models/download-ggml-model.sh small
# Then convert to Q5_1 or copy the small model and rename if your script produces ggml-small-q5_1.bin
```

If the script produces a different name (e.g. `ggml-base.en.bin`), you can either rename it to `ggml-small-q5_1.bin` or change `MODEL_PATH` in `index.ts` to match.

### 4. Verify from the command line

```bash
cd packages/backend/stt-engine

# So the loader finds libwhisper.so.1 in the current dir
export LD_LIBRARY_PATH="$PWD:$LD_LIBRARY_PATH"

# Create a short test WAV (e.g. 1 second of silence) or use any 16 kHz mono WAV
./whisper-cli -m ggml-small-q5_1.bin -f /path/to/test.wav --no-timestamps --threads 4
```

If this prints a line of text (or empty for silence), the STT engine in the app will work the same way.

---

## macOS

- Build whisper.cpp the same way; the library will be `libwhisper.dylib`.
- Copy `build/bin/main` to `whisper-cli` and put `libwhisper.dylib` in this folder. The app sets `DYLD_LIBRARY_PATH` to this folder so the binary can load the dylib.

---

## Step-by-step setup (Windows)

The app looks for **`whisper-cli.exe`** in this folder. Easiest is a **static** build (no DLLs).

### 1. Install build tools

- **Visual Studio 2022** (or Build Tools) with “Desktop development with C++”, or
- **MinGW-w64** + CMake.

### 2. Clone and build whisper.cpp (static = no DLL)

Open **Developer Command Prompt for VS** or a terminal with `cmake` and a C++ compiler in PATH:

```cmd
cd %USERPROFILE%
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp

mkdir build
cd build
cmake .. -DBUILD_SHARED_LIBS=OFF -A x64
cmake --build . --config Release
```

- With **MinGW**: `cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF` then `cmake --build .`
- After build you should have `build\bin\Release\main.exe` (or `main.exe` in `build\bin`).

### 3. Copy into this package

From the **AFE-Learning-App repo root** (adjust paths if your clone is elsewhere):

```cmd
set STT_ENGINE=packages\backend\stt-engine
set WB=%USERPROFILE%\whisper.cpp\build

copy "%WB%\bin\Release\main.exe" "%STT_ENGINE%\whisper-cli.exe"
```

If your build put `main.exe` in `build\bin` instead of `build\bin\Release`, use that path.

### 4. Model file

Put **`ggml-small-q5_1.bin`** in `packages\backend\stt-engine\`. Download from whisper.cpp’s model scripts or Hugging Face if needed.

### 5. Verify from the command line

```cmd
cd packages\backend\stt-engine
whisper-cli.exe -m ggml-small-q5_1.bin -f C:\path\to\test.wav --no-timestamps --threads 4
```

If it prints a line (or nothing for silence), the app will work.

### If you use a shared build (DLL)

- Build with `-DBUILD_SHARED_LIBS=ON`, then copy **`main.exe` → `whisper-cli.exe`** and the generated **`.dll`** (e.g. `whisper.dll`) into this folder.
- The app adds this folder to `PATH` when spawning, so the loader will find the DLL next to the exe.

---

## Summary

1. Build **whisper.cpp** for your OS (see Linux / macOS / Windows sections).
2. Copy the CLI into this folder: **`whisper-cli`** (Linux/macOS) or **`whisper-cli.exe`** (Windows). On Linux/macOS also copy the shared library (and symlink if needed).
3. Put **`ggml-small-q5_1.bin`** in this folder.
4. Run the app; push-to-talk should produce transcripts.
