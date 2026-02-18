#!/usr/bin/env bash
# Copy whisper-cli (and shared lib if present) from iDesktop/whisper.cpp build
# into this package so STT works. Run from repo root or from this directory.

set -e
WHISPER_SRC="${WHISPER_SRC:-/home/phantom/Desktop/whisper.cpp}"
STT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD="${WHISPER_SRC}/build"

if [[ ! -d "$BUILD" ]]; then
  echo "Build dir not found: $BUILD"
  echo "Build first: cd $WHISPER_SRC && mkdir -p build && cd build && cmake .. -DBUILD_SHARED_LIBS=OFF && cmake --build . --config Release"
  exit 1
fi

# Binary: prefer new names (whisper-whisper-cli / whisper-cli), then legacy main
if [[ -f "$BUILD/bin/whisper-whisper-cli" ]]; then
  cp "$BUILD/bin/whisper-whisper-cli" "$STT_DIR/whisper-whisper-cli"
  chmod +x "$STT_DIR/whisper-whisper-cli"
  BIN_COPIED=1
elif [[ -f "$BUILD/bin/whisper-cli" ]]; then
  cp "$BUILD/bin/whisper-cli" "$STT_DIR/whisper-cli"
  chmod +x "$STT_DIR/whisper-cli"
  BIN_COPIED=1
elif [[ -f "$BUILD/bin/main" ]]; then
  cp "$BUILD/bin/main" "$STT_DIR/whisper-cli"
  chmod +x "$STT_DIR/whisper-cli"
  BIN_COPIED=1
elif [[ -f "$BUILD/main" ]]; then
  cp "$BUILD/main" "$STT_DIR/whisper-cli"
  chmod +x "$STT_DIR/whisper-cli"
  BIN_COPIED=1
fi
if [[ -z "$BIN_COPIED" ]]; then
  echo "No binary found in $BUILD (looked for bin/whisper-whisper-cli, bin/whisper-cli, bin/main, main)"
  exit 1
fi

# Shared lib (optional; if you built with -DBUILD_SHARED_LIBS=ON)
if [[ -f "$BUILD/libwhisper.so" ]]; then
  cp "$BUILD/libwhisper.so" "$STT_DIR/"
  ( cd "$STT_DIR" && ln -sf libwhisper.so libwhisper.so.1 )
  echo "Copied binary and libwhisper.so"
elif [[ -f "$BUILD/lib/libwhisper.so" ]]; then
  cp "$BUILD/lib/libwhisper.so" "$STT_DIR/"
  ( cd "$STT_DIR" && ln -sf libwhisper.so libwhisper.so.1 )
  echo "Copied binary and libwhisper.so"
else
  echo "Copied binary (static build; no .so needed)"
fi

echo "Done. STT dir: $STT_DIR"
