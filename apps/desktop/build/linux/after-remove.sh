#!/bin/bash
# AFE Learning App -- Post-Removal Script (Ubuntu/Debian)

if [ "$1" = "purge" ]; then
    rm -rf /etc/skel/.config/OfflineLearningApp 2>/dev/null || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi
