#!/bin/bash
# AFE Learning App -- Post-Installation Script (Ubuntu/Debian)

# Ensure executable permissions on native binaries in installation folder
for opt_dir in "/opt/Amazon Future Engineer/resources" "/opt/amazon-future-engineer/resources"; do
    if [ -d "$opt_dir" ]; then
        chmod +x "$opt_dir/stt/whisper-cli" 2>/dev/null || true
        chmod +x "$opt_dir/tts/piper" 2>/dev/null || true
    fi
done

# Write default config in /etc/skel so new users automatically get default NGO config
mkdir -p /etc/skel/.config/OfflineLearningApp 2>/dev/null || true
if [ ! -f /etc/skel/.config/OfflineLearningApp/config.json ]; then
    echo '{"ngoKey": "D3F41T-K37"}' > /etc/skel/.config/OfflineLearningApp/config.json 2>/dev/null || true
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q /usr/share/icons/hicolor || true
fi
