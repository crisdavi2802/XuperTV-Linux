#!/bin/sh
set -e

DESKTOP="/usr/share/applications/xuper-tv-desktop.desktop"

if [ -f "$DESKTOP" ]; then
    sed -i 's|^Exec=.*|Exec="/opt/XUPER TV+/xuper-tv-desktop" --no-sandbox %U|' "$DESKTOP"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

exit 0
