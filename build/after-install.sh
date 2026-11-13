#!/bin/sh
set -e

DESKTOP="/usr/share/applications/liquidglass-iptv-desktop.desktop"

if [ -f "$DESKTOP" ]; then
    # Mantener la ruta generada por electron-builder (/opt/LIQUIDGLASS IPTV Plus/...)
    # y añadir --no-sandbox antes de %U si no está presente.
    if ! grep -q -- "--no-sandbox" "$DESKTOP"; then
        sed -i 's| %U$| --no-sandbox %U|' "$DESKTOP"
    fi
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

exit 0
