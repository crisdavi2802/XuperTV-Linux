# XuperTV+ 2.1.0-rc.1 para Linux — Notas de versión

**Fecha:** 2026-11-08  
**Base fuente:** `XUPER-TV-Plus-2.1.0-rc.1-Portable.exe` (NSIS + `app-64.7z`)  
**Versión Linux:** `2.1.0-rc.1`  
**Máquina de referencia:** Celeron N4120 (4 núcleos 1.10–2.60 GHz, UHD 600)  
**Objetivo:** equilibrio estable — rápido, ligero en CPU/GPU y sin romper funciones.

---

## 1. Código fuente utilizado (2.1)

Extraído del portable oficial 2.1.0-rc.1 sin iniciar el .exe de Windows:

```
/home/cristian/Descargas/XUPER-TV-Plus-2.1.0-rc.1-Portable.exe
  └─ NSIS ($PLUGINSDIR/app-64.7z)
      └─ resources/app.asar (6.3 MB, md5 8eefc8f31fb45b59fccdb102ab765feb)
          ├─ desktop/main.cjs
          ├─ desktop/platform.cjs
          ├─ desktop/recorder.cjs
          ├─ desktop/network-monitor.cjs      ← nuevo en 2.1
          ├─ desktop/official-openvpn.cjs     ← nuevo en 2.1
          ├─ desktop/private-vault.cjs        ← nuevo en 2.1
          ├─ desktop/vpn-service.cjs          ← nuevo en 2.1
          ├─ desktop/vpn-broker/Broker.cs     ← nuevo en 2.1
          ├─ server/app.cjs, jobs.cjs, media.cjs, nook.cjs, releases.cjs, schedules.cjs, series.cjs, start.cjs
          ├─ server/download-queue.cjs        ← nuevo en 2.1
          ├─ server/exclusive-channels.cjs    ← nuevo en 2.1
          ├─ server/loopback.cjs              ← nuevo en 2.1
          ├─ server/regional-vpn.cjs          ← nuevo en 2.1
          ├─ public/ (pc, assets, nook, data, css, js, ...)
          └─ vendor/magis.cjs, proxy.cjs, ts-indexer.cjs
```

**Proyecto Linux:** `/home/cristian/Documentos/XuperTV-Linux-2.1`  
**Salida final:** `/home/cristian/Documentos/XuperTV-2.1-Linux-Final/`

---

## 2. Comparativa 1.3.0 → 2.1.0-rc.1

| Elemento | 1.3.0 | 2.1.0-rc.1 | Acción Linux |
|----------|-------|------------|--------------|
| `package.json` | 1.3.0 | 2.1.0-rc.1, `xuperEdition: standard`, `buildInfo.builtAt 2026-11-03` | Nueva versión + config electron-builder 1.3 reutilizada |
| `desktop/main.cjs` | 37 líneas, sin VPN | 38 líneas, `let vpn`, guarda `process.platform==='win32' && xuperEdition==='vpn-local'` | **Reutilizado** + parche `--no-sandbox` Linux |
| `desktop/platform.cjs` | 6 líneas, sin Linux | **Idéntico** a 1.3 | **Reutilizado** (versión repo 1.3 con `/usr/bin/ffmpeg`) |
| `desktop/recorder.cjs` | 14 líneas | **Idéntico** a 1.3 | Reutilizado (ver optimización abajo) |
| `server/jobs.cjs`, `nook.cjs`, `schedules.cjs`, `series.cjs`, `start.cjs` | — | **Idénticos** | Sin cambios |
| `server/app.cjs` | 16 KB | 19 KB (VPN, DownloadQueue, ExclusiveChannels, Loopback) | Adoptado tal cual |
| `server/media.cjs` | siempre `libx264 veryfast crf20` | si `videoCodec==='h264'` → `-c:v copy`, si no re-codifica | **Mejora nativa 2.1** para N4120 |
| `server/releases.cjs` | 1.6 KB | 2.1 KB | Adoptado |
| `public/pc/assets` | `index-C7QdAQYV.css`, `index-CWQaUgrV.js` | `hls-D6a35TnA.js`, `index-88I0-1tY.js`, `index-DcMg7C6k.css` | Adoptado (no parcheado) |
| Archivos nuevos | — | 11 archivos (5 desktop + 4 server + 3 assets) | Incluidos en `build.files` vía `desktop/**/*`, `server/**/*` |
| `ffmpeg.exe`/`ffprobe.exe` en Windows | md5 `425c97fa...` | **Mismos** md5 | En Linux se usa sistema `/usr/bin/ffmpeg 8.0.1` (no se empaqueta) |
| `XUPER TV+.exe` (Electron) | 239 MB, md5 `9ab75a68...` | 239 MB, md5 `66908325...` | En Linux se compila con **Electron 45.2.2** |
| `app.asar` | 6.3 MB, md5 `6eb50fe1...` | 6.3 MB, md5 `8eefc8f3...` | Nueva versión |

**Total archivos app.asar:** 240 → **251** (+11).

---

## 3. Adaptaciones Linux reutilizadas de 1.3

Copiadas desde `/home/cristian/Documentos/XuperTV-Linux` (v1.3.0-linux, commit 92c98ee):

- `build/icon.png` + `build/xuper.jpeg` + `preparar-icono.sh` (ffmpeg 512×512)
- `build/after-install.sh` — corrige `Exec="/opt/XUPER TV+/xuper-tv-desktop" --no-sandbox %U` en `.desktop`
- `package.json` config `electron-builder 26.18.0`:
  - `appId com.xuptertv.desktop` (se mantiene por compatibilidad)
  - `productName XUPER TV Plus`, `linux.category AudioVideo`, `syncDesktopName true`, `icon build/icon.png`
  - `deb.depends [ffmpeg]`, `afterInstall build/after-install.sh`
  - `artifactName xuper-tv-plus_${version}_${arch}.${ext}`
- `desktop/platform.cjs` (repo 1.3): en Linux `ffmpeg=/usr/bin/ffmpeg`, `ffprobe=/usr/bin/ffprobe`
- `desktop/main.cjs`: `if (linux) app.commandLine.appendSwitch('no-sandbox')`

**Sin cambios necesarios** en `recorder.cjs` (solo formato en repo 1.3, lógica idéntica) ni en VPN (guard `win32` + `vpn-local`, en Linux `standard` = desactivado).

---

## 4. Optimización bajo consumo — N4120 (equilibrio estable)

Objetivo: **rápido en playback, ligero en idle**, sin degradar calidad innecesariamente.

| # | Cambio | Archivo | Efecto |
|---|--------|---------|--------|
| 4.1 | Recorder tick `1000ms → 5000ms` + early-exit si 0 programaciones | `desktop/recorder.cjs` | -80% despertares idle |
| 4.2 | Flags Chromium Linux ligera: `--disable-dev-shm-usage`, `--disable-features=Translate` | `desktop/main.cjs` | Menos IPC/GPU en N4120 |
| 4.3 | Media: mantener `h264 copy` nativo 2.1; solo re-codificar si no es h264 con `veryfast` (estable, no `ultrafast` agresivo) | `server/media.cjs` | Equilibrio calidad/CPU |
| 4.4 | `probeDuration` con caché y timeout 8s (antes 10s) | `server/app.cjs` | Menos spawns ffprobe |
| 4.5 | No parchear bundles frontend (`5s` jobs / `1.2s` player) | — | Evitar rotura |

**Por qué no `ultrafast`:** en N4120 `veryfast crf20` solo se usa cuando el origen no es h264. `ultrafast` recorta 30-40% CPU pero sube artefactos en movimiento. Equilibrio elegido: `veryfast` + `copy` cuando sea posible.

---

## 5. Artefactos generados

Carpeta final: `/home/cristian/Documentos/XuperTV-2.1-Linux-Final/`

| Carpeta | Formato | Distros | Comando / Estado |
|---------|---------|---------|------------------|
| `deb/` | `.deb` | Debian, Ubuntu, Mint, Pop!_OS | `npm run build:linux` → `release/xuper-tv-plus_2.1.0-rc.1_amd64.deb` ✅ |
| `arch-pacman/` | `x64.pacman` | Arch, Manjaro, EndeavourOS | `npm run build:linux:pacman` |
| `fedora-rpm/` | `.rpm` | Fedora, RHEL, Alma, Rocky | `npm run build:linux:rpm` |
| `AppImage/` | `.AppImage` | Universal Linux | `electron-builder --linux AppImage --x64` |
| `flathub-flatpak/` | `.flatpak` | Universal (Flathub-ready) | Ver `flatpak/manifest.json` + `README-FLATPAK.md` |

**Versiones probadas en compilación:** Node 22.22.1, npm 9.2.0, Electron 45.2.2, electron-builder 26.18.0, ffmpeg sistema 8.0.1-3ubuntu2.

---

## 6. Cómo instalar

### DEB (Ubuntu/Debian)
```bash
sudo apt install ./xuper-tv-plus_2.1.0-rc.1_amd64.deb
# tras instalar, after-install.sh pone:
# Exec="/opt/XUPER TV+/xuper-tv-desktop" --no-sandbox %U
```

### RPM (Fedora)
```bash
sudo dnf install ./xuper-tv-plus_2.1.0-rc.1_x86_64.rpm
```

### Pacman (Arch)
```bash
sudo pacman -U ./xuper-tv-plus_2.1.0-rc.1_x64.pacman
```

### AppImage
```bash
chmod +x ./xuper-tv-plus_2.1.0-rc.1_x86_64.AppImage
./xuper-tv-plus_2.1.0-rc.1_x86_64.AppImage
# sin sudo; para sandbox suele necesitar --no-sandbox en el Exec/.desktop
```

### Flatpak (Flathub)
```bash
flatpak install ./xuper-tv-plus_2.1.0-rc.1.flatpak
flatpak run com.xupertvplus.desktop
```
Ver `flathub-flatpak/README-FLATPAK.md` para manifiesto y límites de sandbox.

---

## 7. Qué NO se modificó

- No se reescribió el reproductor ni la UI React.
- No se parchearon bundles `public/pc/assets/*.js`.
- No se modificaron licencias `LICENSE`, `THIRD_PARTY.md`, `LICENSE-LINUX`.
- VPN OpenVPN (`Broker.cs`, `vpn-service.cjs`) queda incluida pero inactiva en Linux/`standard`.

---

## 8. Próximos pasos

1. Probar DEB en N4120: idle 2 min (top), playback h264 (top), VOD no-h264 (calidad vs CPU).
2. Generar RPM/Pacman/IPmage y copiar a carpetas finales.
3. Completar Flatpak (runtime org.freedesktop Platform 23.08 + permisos).
4. Publicar tag `v2.1.0-rc.1-linux` (GitHub) con este CHANGELOG.

*Generado durante la auditoría 1.3 → 2.1 del 2026-11-08.*
