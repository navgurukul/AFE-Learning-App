#!/bin/bash
# AFE Learning App -- Post-Installation Script (Ubuntu/Debian)

# Ensure executable permissions on native binaries and correct sandbox permissions
for opt_base in "/opt/Amazon Future Engineer" "/opt/amazon-future-engineer"; do
    if [ -d "$opt_base" ]; then
        if [ -f "$opt_base/chrome-sandbox" ]; then
            chown root:root "$opt_base/chrome-sandbox" 2>/dev/null || true
            chmod 4755 "$opt_base/chrome-sandbox" 2>/dev/null || true
        fi
        if [ -d "$opt_base/resources" ]; then
            chmod +x "$opt_base/resources/stt/whisper-cli" 2>/dev/null || true
            chmod +x "$opt_base/resources/tts/piper" 2>/dev/null || true
        fi
    fi
done

# Write default config in /etc/skel so new users automatically get default NGO config
mkdir -p /etc/skel/.config/OfflineLearningApp 2>/dev/null || true
if [ ! -f /etc/skel/.config/OfflineLearningApp/config.json ]; then
    echo '{"ngoKey": "D3F41T-K37"}' > /etc/skel/.config/OfflineLearningApp/config.json 2>/dev/null || true
fi

# Ensure the desktop entry launches with --no-sandbox (prevents Chromium space-in-path zygote crash)
if [ -f /usr/share/applications/amazon-future-engineer.desktop ]; then
    sed -i 's|--no-sandbox||g' /usr/share/applications/amazon-future-engineer.desktop
    sed -i 's|Exec=\([^%]*\)|Exec=\1 --no-sandbox |g' /usr/share/applications/amazon-future-engineer.desktop
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
