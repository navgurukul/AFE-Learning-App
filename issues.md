# AFE Linux Build and Video Player Investigation Report

Date: October 13, 2026
Branch: build/linux / UAT
Repository: AFE (Amazon Future Engineer)

---

## 1. Overview and Core Problem

During testing of the Linux desktop build of AFE, course videos in the video player were rendering as a solid black screen. Instead of the standard bottom video control bar (as seen on Windows), the player rendered an audio-only capsule control widget in the center of the frame. Audio playback continued normally, and watch time accumulated, but video frames never displayed.

Additionally, multiple build errors and performance bottlenecks were encountered when attempting to package the Linux installer on a Windows development environment.

---

## 2. Issues Mitigated Today

### [Mitigated] 1. Linux Black Screen and Audio-Only Controls
* Root Cause:
  * All 27 course videos (13 AWS Data Center Tour chapters and 14 Robotics Fulfillment Tour chapters) were encoded with HEVC (H.265 / libx265).
  * Windows 10/11 decodes HEVC via OS-level platform and GPU hardware decoders (Media Foundation / DirectX).
  * Chromium and Electron do NOT bundle an HEVC software decoder due to patent licensing fees.
  * On Linux (especially standard educational laptop distributions without proprietary VA-API driver packages), Chromium cannot decode the HEVC video stream.
  * Because audio is encoded in Opus (open format decoded natively in software), Chromium dropped the unrenderable video stream and collapsed the HTML5 video element into an audio-only playback widget.
* Resolution:
  * Re-encoded video tracks to universal H.264 (libx264, yuv420p).
  * Preserved all 7 multilingual Opus audio tracks (English, Hindi, Telugu, Gujarati, Tamil, Kannada, Marathi) losslessly using direct stream copying (`-map 0 -c:a copy`).
  * Verified that both Windows and Linux now decode and display video frames with the standard bottom video controls.

### [Mitigated] 2. Electron Linux Video Hardware Acceleration & URL Sanitization
* Root Cause:
  * Conservative GPU blocklists on Linux could prevent hardware acceleration even when available.
  * Media protocol URL paths on Linux could produce leading slash mismatches when resolving assets.
* Resolution:
  * Added Linux hardware acceleration switches in `apps/desktop/src/main/index.ts`:
    * `ignore-gpu-blocklist`
    * `enable-gpu-rasterization`
    * `enable-zero-copy`
  * Added path normalization in the `media://` protocol handler to sanitize leading slashes across platforms.

### [Mitigated] 3. Windows Cross-Compilation Failure for Linux (Symlinks and mksquashfs)
* Root Cause:
  * Running `electron-builder --linux` on Windows with target `AppImage` attempted to:
    1. Create Linux desktop icon symlinks, which failed with `A required privilege is not held by the client` (Windows non-developer account restriction).
    2. Execute `mksquashfs`, which is a Linux ELF binary that cannot run on Windows.
  * Running with target `deb` failed with `fpm executable not found` (fpm requires a Ruby environment not present on Windows).
* Resolution:
  * Updated `apps/desktop/electron-builder.config.cjs`:
    * When running on Windows (`process.platform === 'win32'`), target is set to `dir`.
    * When running on Linux CI / Ubuntu runners, target remains `['AppImage', 'deb']`.
  * The complete unpacked Linux application is built cleanly in `apps/desktop/release/linux-unpacked` in ~1.5 minutes without error.

### [Mitigated] 4. Extreme 7-Zip Compression Freeze on Large Media Bundles
* Root Cause:
  * Electron-builder's internal `7za.exe` with `compression: maximum` ran single-threaded LZMA compression on a 2.6 GB directory containing pre-compressed videos.
  * This stalled packaging for over 25 minutes with single-core CPU saturation.
* Resolution:
  * Implemented an automated `afterAllArtifactBuild` hook in `electron-builder.config.cjs` using Windows native `tar.exe` (`tar -czf`).
  * The compressed Linux release archive `Amazon Future Engineer-Setup-1.5.311.tar.gz` (2.01 GB) was generated in 1 minute and 15 seconds.

---

## 3. Current Issues & Decisions In Progress

### [In Progress] Video File Size Optimization for GitHub 1.5 GB Release Limit
* Context:
  * The unpacked Linux application directory (`linux-unpacked`) is ~2.6 GB total.
    * Chromium engine, Node runtime, app code: ~250 MB
    * Offline AI models (Whisper STT + Piper TTS): ~183 MB
    * Node dependencies & SQLite database: ~700 MB
    * Course video assets (27 chapters, 7 audio tracks): ~1.34 GB (at CRF 23)
  * The compressed deployment bundle at CRF 23 is 2.01 GB, which exceeds the target 1.5 GB GitHub release attachment limit.
* Status & Comparison Samples:
  * Created test comparison videos in `c:\Mukul\Navgurukul\RMS\video_test`:
    * `Module_Chapter_1_CRF23.mkv` (52.3 MB) - Near-lossless, but larger total library size.
    * `Module_Chapter_1_CRF26.mkv` (33.3 MB) - Balanced sweet spot: 36% size reduction, sharp 1080p text and slides. Total video library stays at ~980 MB.
    * `Module_Chapter_1_CRF28.mkv` (28.4 MB) - 46% size reduction (identical in size to original 28.6 MB HEVC file). Slight softening in high-motion scenes.
* Next Step:
  * User review of comparison samples in `video_test`.
  * Batch re-encode all 27 chapters with CRF 26 to achieve the under-1.5 GB release target.

---

## 4. Potential Future Issues & Precautions

1. Linux Installer Packaging Environment:
   * Native Linux packages (`.deb` and `.AppImage`) cannot be built natively on Windows due to external Linux tooling requirements (`mksquashfs`, `fpm`, `dpkg`).
   * Production `.deb` and `.AppImage` packages should be generated via the existing GitHub Actions workflow (`.github/workflows/build-linux.yml`) running on `ubuntu-latest`.
   * For Windows local testing, the `linux-unpacked` folder or `tar.gz` archive should be used.

2. Ubuntu 24.04 AppArmor Sandbox Restrictions:
   * Recent Ubuntu 24.04 releases enforce restricted unprivileged user namespaces, which can prevent Electron apps from launching without `--no-sandbox` or an explicit AppArmor profile.
   * `executableArgs: ['--no-sandbox']` has already been added to the desktop builder config to mitigate this.

3. System Runtime Libraries on Target Linux Laptops:
   * Target educational laptops must have core GUI and sound dependencies installed (`libasound2`, `libgtk-3-0`, `libnss3`, `libxss1`).
   * These are specified in the `.deb` package dependency list, but for portable `tar.gz` distributions, target machines must have standard desktop packages present.

4. Audio Track Switching Compatibility:
   * The video player uses `video.audioTracks` API to switch between the 7 language tracks.
   * This API relies on `app.commandLine.appendSwitch('enable-experimental-web-platform-features')` in the Electron main process, which must remain enabled across all versions.
