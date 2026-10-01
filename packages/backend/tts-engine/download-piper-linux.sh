#!/usr/bin/env bash
# Download Piper TTS binaries for Linux x86_64
set -e

TTS_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Downloading Linux Piper binaries into ${TTS_DIR}..."

TMP_TAR="$(mktemp 2>/dev/null || mktemp -t 'piper')".tar.gz
curl -fsSL "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz" -o "$TMP_TAR"

tar -xzf "$TMP_TAR" -C "$TTS_DIR" --strip-components=1 \
    piper/piper \
    piper/libonnxruntime.so* \
    piper/libespeak-ng.so* \
    piper/libpiper_phonemize.so* \
    piper/libtashkeel_model.ort

rm -f "$TMP_TAR"

# Ensure symlinks / soname links exist
cd "$TTS_DIR"
[ -f libespeak-ng.so.1 ] || ln -sf libespeak-ng.so.1.* libespeak-ng.so.1 2>/dev/null || cp libespeak-ng.so.1.* libespeak-ng.so.1
[ -f libpiper_phonemize.so.1 ] || ln -sf libpiper_phonemize.so.1.* libpiper_phonemize.so.1 2>/dev/null || cp libpiper_phonemize.so.1.* libpiper_phonemize.so.1
[ -f libonnxruntime.so ] || ln -sf libonnxruntime.so.1.* libonnxruntime.so 2>/dev/null || cp libonnxruntime.so.1.* libonnxruntime.so

chmod +x "$TTS_DIR/piper"
echo "Done. Linux Piper binaries installed in ${TTS_DIR}"
