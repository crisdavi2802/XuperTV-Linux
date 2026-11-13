# LiquidGlass+ 2.1.0-rc.1 para Linux — Carpeta final

**Código fuente:** `~/Documentos/LiquidGlass-Linux-2.1` (versión 2.1.0-rc.1)  
**Máquina referencia:** Celeron N4120 — equilibrio estable, rápido, bajo consumo  
**Fecha:** 2026-11-08

## Contenido

| Carpeta | Qué hay | Para quién |
|---------|---------|------------|
| `deb/` | `.deb` amd64 | Debian / Ubuntu / Mint |
| `arch-pacman/` | `.pacman` x64 | Arch / Manjaro / EndeavourOS |
| `fedora-rpm/` | `.rpm` x86_64 | Fedora / RHEL / Alma / Rocky |
| `AppImage/` | `.AppImage` x86_64 | Cualquier Linux (sin instalar) |
| `flathub-flatpak/` | `.flatpak` + manifiesto | Flathub / Universal |
| `docs/` | `CHANGELOG.md`, `INVENTARIO-CODIGO-2.1.md` | Documentación de cambios |

## Instalación rápida

**DEB:** `sudo apt install ./deb/liquidglass-iptv-plus_2.1.0-rc.1_amd64.deb`  
**RPM:** `sudo dnf install ./fedora-rpm/liquidglass-iptv-plus_2.1.0-rc.1_x86_64.rpm`  
**Pacman:** `sudo pacman -U ./arch-pacman/liquidglass-iptv-plus_2.1.0-rc.1_x64.pacman`  
**AppImage:** `chmod +x AppImage/*.AppImage && ./AppImage/*.AppImage`  
**Flatpak:** `flatpak install flathub-flatpak/*.flatpak && flatpak run com.liquidglassplus.desktop`

## Documentación

- `docs/CHANGELOG.md` — comparativa 1.3.0 → 2.1.0-rc.1, parches Linux reutilizados y optimización N4120.
- `docs/INVENTARIO-CODIGO-2.1.md` — estructura, versiones exactas (Electron 45.2.2, electron-builder 26.18.0, ffmpeg 8.0.1) y comandos por formato.

## Notas N4120

- Playback h264 usa `-c:v copy` (ahorro CPU nativo 2.1).
- Recorder tick reducido 1s → 5s.
- Flags Chromium Linux ligera (`--no-sandbox`, `--disable-dev-shm-usage`, `--disable-features=Translate`).
- FFmpeg del sistema (`/usr/bin/ffmpeg 8.0.1`), dependencia declarada en DEB/RPM.

*Tag sugerido: `v2.1.0-rc.1-linux`*
