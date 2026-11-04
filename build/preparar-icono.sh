#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

ORIGEN="$SCRIPT_DIR/xuper.jpeg"
DESTINO="$SCRIPT_DIR/icon.png"

if [ ! -f "$ORIGEN" ]; then
    echo "ERROR: No se encontró el icono: $ORIGEN"
    exit 1
fi

ffmpeg -y -i "$ORIGEN" \
-vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" \
-frames:v 1 "$DESTINO"

echo "Icono preparado correctamente: $DESTINO"
