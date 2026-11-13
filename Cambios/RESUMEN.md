# Resumen rápido 1.3 → 2.1

## Upstream (lo que trae el .exe 2.1)
| Archivo | 1.3 | 2.1 | Acción |
|---|---|---|---|
| `package.json` | 1.3.0 | 2.1.0-rc.1, `liquidglassEdition standard`, `buildInfo 2026-11-03` | Nueva versión |
| `desktop/main.cjs` | 37 lín. | 38 lín. (+`vpn`, `win32 && vpn-local`) | Adoptado + `--no-sandbox` Linux |
| `desktop/platform.cjs` | 6 lín. | **idéntico** | Reutilizado (versión repo 1.3) |
| `desktop/recorder.cjs` | 14 lín. | **idéntico** | Reutilizado (tick 1s→5s N4120) |
| `desktop/network-monitor.cjs`, `official-openvpn.cjs`, `private-vault.cjs`, `vpn-service.cjs`, `vpn-broker/Broker.cs` | — | **nuevos** | Incluidos (inactivos en Linux/standard) |
| `server/app.cjs` | 16K | 19K | Adoptado |
| `server/media.cjs` | siempre `libx264 veryfast` | si h264 → `copy` | ✅ baja CPU nativa |
| `server/releases.cjs` | 1.6K | 2.1K | Adoptado |
| `server/download-queue.cjs`, `exclusive-channels.cjs`, `loopback.cjs`, `regional-vpn.cjs` | — | **nuevos** | Incluidos |
| `server/jobs/nook/schedules/series/start.cjs` | — | **idénticos** | Sin cambio |
| `public/pc/assets/` | `index-C7/CW` | `hls-D6 + index-88/Dc` | Adoptado |
| `ffmpeg.exe`/`ffprobe.exe` Win | md5 `425c97fa…` | **mismo** md5 | Linux usa `/usr/bin/ffmpeg 8.0.1` |
| `LIQUIDGLASS IPTV PLAYER.exe` | 239M `9ab75a68…` | 239M `66908325…` | Linux: Electron 45.2.2 |
| `app.asar` | 6.3M `6eb50fe1…` | 6.3M `8eefc8f3…` | 240 → 251 archivos (+11) |

## Nuestros parches Linux (carpeta de compilación)
| Parche | Archivo | Por qué |
|---|---|---|
| `ffmpeg=/usr/bin/ffmpeg` en Linux | `desktop/platform.cjs` | Reutilizado 1.3, depend. sistema |
| `--no-sandbox` en Linux | `desktop/main.cjs` | Sandbox / permisos N4120 |
| electron-builder + icon + `build/after-install.sh` + `preparar-icono.sh` | `package.json`, `build/` | Reutilizado 1.3 |
| `--disable-dev-shm-usage`, `--disable-features=Translate` | `main.cjs` | Menos IPC/GPU idle N4120 |
| tick `1s→5s` + `unref()` | `recorder.cjs` | −80% despertares idle |
| `probeDuration` timeout `10s→8s` | `server/app.cjs` | Menos bloqueo ffprobe |
| **Fix menú:** `after-install.sh` conserva `/opt/LIQUIDGLASS IPTV Plus/` + `--no-sandbox`; `desktopName` | `build/after-install.sh`, `package.json` | El error `/opt/LIQUIDGLASS IPTV PLAYER/` ya no existe |
| Flatpak 25.08 + `finishArgs` | `package.json: flatpak` | Runtime instalado aquí (25.08/26.08) |

## Artefactos finales (menú verificado)
| Formato | Archivo | Tamaño |
|---|---|---|
| DEB | `liquidglass-iptv-plus_2.1.0-rc.1_amd64.deb` | 101M |
| RPM (Fedora) | `liquidglass-iptv-plus_2.1.0-rc.1_x86_64.rpm` | 90M |
| Pacman (Arch) | `liquidglass-iptv-plus_2.1.0-rc.1_x64.pacman` | 93M |
| AppImage | `liquidglass-iptv-plus_2.1.0-rc.1_x86_64.AppImage` | 124M |
| Flatpak | `liquidglass-iptv-plus_2.1.0-rc.1_x86_64.flatpak` | 93M |
