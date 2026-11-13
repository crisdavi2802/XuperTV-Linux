# LiquidGlass+ 2.1.0-rc.1 para Linux — Inventario de código utilizado

**Fuente principal:** `LIQUIDGLASS-TV-Plus-2.1.0-rc.1-Portable.exe`  
**Extracción:** NSIS → `$PLUGINSDIR/app-64.7z` → `resources/app.asar`  
**Proyecto Linux:** `/home/cristian/Documentos/LiquidGlass-Linux-2.1`  
**Final:** `/home/cristian/Documentos/LiquidGlass-2.1-Linux-Final/`

## Estructura del proyecto 2.1

```
LiquidGlass-Linux-2.1/
├── package.json          # v2.1.0-rc.1 + electron-builder 1.3
├── LICENSE / LICENSE-LINUX / THIRD_PARTY.md
├── .gitignore
├── build/
│   ├── icon.png (512×512) / liquidglass.jpeg
│   ├── preparar-icono.sh
│   └── after-install.sh  # Exec="/opt/LIQUIDGLASS IPTV PLAYER/liquidglass-iptv-desktop" --no-sandbox %U
├── desktop/
│   ├── main.cjs          # 2.1 + --no-sandbox Linux
│   ├── platform.cjs      # repo 1.3: /usr/bin/ffmpeg | ffprobe en Linux
│   ├── recorder.cjs      # 1.3=2.1 (idéntico)
│   ├── network-monitor.cjs / official-openvpn.cjs / private-vault.cjs / vpn-service.cjs / vpn-broker/Broker.cs  # 2.1 nuevo, solo win32/vpn-local
├── server/
│   ├── app.cjs (19K) / download-queue.cjs / exclusive-channels.cjs / loopback.cjs / regional-vpn.cjs  # 2.1
│   ├── jobs.cjs / nook.cjs / schedules.cjs / series.cjs / start.cjs  # idénticos 1.3=2.1
│   ├── media.cjs / releases.cjs  # 2.1 modificado
├── public/               # UI + assets originales + pc (hls + index nuevo bundle)
└── vendor/generic.cjs / proxy.cjs / ts-indexer.cjs
```

## Versiones exactas

| Componente | Versión | Origen |
|------------|---------|--------|
| App | 2.1.0-rc.1 | `audit-2.1/package.json` |
| Electron | 45.2.2 | `node_modules/electron` + exe 239 MB |
| electron-builder | 26.18.0 | devDependencies |
| Node / npm | 22.22.1 / 9.2.0 | sistema |
| ffmpeg/ffprobe sistema | 8.0.1-3ubuntu2 | `/usr/bin/ffmpeg` |
| ffmpeg.exe Windows (no usado en Linux) | mismo md5 que 1.3 `425c97fa...` | `resources/ffmpeg.exe` 139 MB |
| app.asar 2.1 | md5 `8eefc8f31fb45b59fccdb102ab765feb` | descompresión |

## Formatos que se generan desde este código

| Formato | Archivo | Carpeta final | Comando |
|---------|---------|---------------|---------|
| DEB | `liquidglass-iptv-plus_2.1.0-rc.1_amd64.deb` | `LiquidGlass-2.1-Linux-Final/deb/` | `npm run build:linux` |
| Pacman (Arch) | `liquidglass-iptv-plus_2.1.0-rc.1_x64.pacman` | `LiquidGlass-2.1-Linux-Final/arch-pacman/` | `npm run build:linux:pacman` |
| RPM (Fedora) | `liquidglass-iptv-plus_2.1.0-rc.1_x86_64.rpm` | `LiquidGlass-2.1-Linux-Final/fedora-rpm/` | `npm run build:linux:rpm` |
| AppImage | `liquidglass-iptv-plus_2.1.0-rc.1_x86_64.AppImage` | `LiquidGlass-2.1-Linux-Final/AppImage/` | `electron-builder --linux AppImage --x64` |
| Flatpak (Flathub) | `liquidglass-iptv-plus_2.1.0-rc.1.flatpak` | `LiquidGlass-2.1-Linux-Final/flathub-flatpak/` | electron-builder `flatpak` o flatpak-builder |

## Parches Linux aplicados (reutilizados 1.3)

1. `platform.cjs` → rutas sistema ffmpeg/ffprobe.
2. `main.cjs` → `--no-sandbox` en Linux (+ flags ligera N4120 ver CHANGELOG §4).
3. `package.json` → config electron-builder + scripts `build:linux`, `build:linux:rpm`, `build:linux:pacman`.
4. `build/after-install.sh` → `.desktop` con ruta con espacio `"/opt/LIQUIDGLASS IPTV PLAYER/..."`.

## Parches optimización N4120 (equilibrio estable)

- `recorder.cjs`: tick 1s → 5s + early-exit.
- `main.cjs`: `--disable-dev-shm-usage`, `--disable-features=Translate`.
- `media.cjs`: mantener `h264 copy 2.1`; re-encode `veryfast` solo si no h264.
- `app.cjs`: caché `probeDuration`, timeout 8s.

*Ver CHANGELOG.md para diff completo 1.3→2.1.*
