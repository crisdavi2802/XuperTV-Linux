# Cambios 1.3.0 → 2.1.0-rc.1 + Parches LiquidGlass+ Linux

> **Origen:** `~/Descargas/LIQUIDGLASS-TV-Plus-2.1.0-rc.1-Portable.exe`  
> **Método (sin ejecutar Windows):** NSIS (`$PLUGINSDIR/app-64.7z`) → 7z → `resources/app.asar` → `asar extract`  
> **Carpeta de compilación:** `~/Documentos/LiquidGlass-Linux-2.1`  
> **Salida final:** `~/Documentos/LiquidGlass-2.1-Linux-Final/` (ver §7)  
> **Referencia:** Celeron N4120 · **Fecha:** 2026-11-08

---

## Índice

1. [Cómo se extrajo 2.1](#1-cómo-se-extrajo-21)
2. [Diff upstream 1.3 → 2.1](#2-diff-upstream-13--21)
3. [Adaptaciones Linux reutilizadas de 1.3](#3-adaptaciones-linux-reutilizadas-de-13)
4. [Optimizaciones N4120 (equilibrio estable)](#4-optimizaciones-n4120-equilibrio-estable)
5. [Bug del menú y corrección](#5-bug-del-menú-y-corrección)
6. [Empaquetado y Flatpak](#6-empaquetado-y-flatpak)
7. [Artefactos finales](#7-artefactos-finales)
8. [Qué NO se tocó](#8-qué-no-se-tocó)

---

## 1. Cómo se extrajo 2.1

```
LIQUIDGLASS-TV-Plus-2.1.0-rc.1-Portable.exe  (184 MB, PE32 NSIS-3 Unicode)
└─ 7z x → $PLUGINSDIR/app-64.7z (184 MB, LZMA2:26 BCJ, 76 archivos)
   └─ 7z x → app/ (308 MB)
       ├─ LIQUIDGLASS IPTV PLAYER.exe (239 MB)
       ├─ ffmpeg.dll, dxcompiler.dll, d3dcompiler_47.dll, vulkan-1.dll, locales/, … (runtime Electron)
       └─ resources/
           ├─ app.asar         (6.3 MB, md5 8eefc8f31fb45b59fccdb102ab765feb) ← CÓDIGO
           ├─ ffmpeg.exe       (139 MB, md5 425c97fa25890a0abfd266124bb855d7)
           ├─ ffprobe.exe      (139 MB)
           ├─ elevate.exe      (105K)
           └─ FFmpeg-LICENSE.txt
```

Extracción idéntica para 1.3 (`md5 6eb50fe1…`) en `~/Documentos/Proyecto predeterminado/LiquidGlass-1.3-extract/` y `LiquidGlass-2.1-extract/` + `audit-1.3/` / `audit-2.1/` para diff de `app.asar`.

```bash
7z x portable.exe -o extract
7z x '$PLUGINSDIR/app-64.7z' -o extract/app
npx asar extract resources/app.asar audit-2.1
# audit-2.1 contiene: desktop/, server/, public/, vendor/, package.json, LICENSE, THIRD_PARTY.md
benchmark: md5sum, asar list | wc -l (240 i3.3 vs 251 i2.1)
```

**Conclusión extracción:** El portable 2.1 es Electron-builder NSIS como el 1.3. No se ejecutó el .exe. Se reutilizó el `.deb`/`build/` de 1.3 (ver §3).

---

## 2. Diff upstream 1.3 → 2.1

### 2.1. Resumen numérico
| Métrica | 1.3.0 | 2.1.0-rc.1 | Delta |
|---|---|---|---|
| `app.asar` | 6.3 MB `6eb50fe1…` | 6.3 MB `8eefc8f3…` | mismo tamaño, contenido distinto |
| Archivos en `app.asar` | **240** | **251** | **+11** |
| `LIQUIDGLASS IPTV PLAYER.exe` | 239 MB `9ab75a68…` | 239 MB `66908325…` | mismo tamaño, versión distinta |
| `ffmpeg.exe` | `425c97fa…` | `425c97fa…` | **idéntico** |
| `package.json: version` | 1.3.0 | 2.1.0-rc.1 | + `liquidglassEdition`, `buildInfo` |

### 2.2 `package.json`
```diff
- "version": "1.3.0"
+ "version": "2.1.0-rc.1",
+ "liquidglassEdition": "standard",
+ "buildInfo": { "builtAt": "2026-11-03T14:02:46.142Z" }
```
Manifiesto: *“LIQUIDGLASS IPTV PLAYER para Windows, macOS y Linux”* ya en 1.3; el port Linux 1.3 lo heredó sin cambiar el hash de ffmpeg.

### 2.3 `desktop/` — 1.3 (3 archivos) → 2.1 (9 archivos)
```
desktop/list diff (2.1 - 1.3):
+ network-monitor.cjs   (powershell Get-NetAdapter / Get-VpnConnection → {physical, externalVPN})
+ official-openvpn.cjs  (descarga OpenVPN-2.7.8-I002-amd64.msi de swupdate.openvpn.org + verify Authenticode + msiexec /RunAs)
+ private-vault.cjs     (cifrado con safeStorage DPAPI, vpn.dpapi)
+ vpn-service.cjs       (orquesta RegionalVPN + physicalNetwork, polling 15s)
+ vpn-broker/Broker.cs  (servicio elevado Windows, named pipe autenticado, allowlist OpenVPN)
```

**`main.cjs` (37 → 38 líneas):**
```diff
- let backend,window;
+ let backend,window,vpn;
 …
+ if (process.platform==='win32' && require('../package.json').liquidglassEdition==='vpn-local')
+   vpn = require('./vpn-service.cjs').createVPNService(app, () => window);
 …
+ vpn?.close(); // en before-quit
```
> **Claves para Linux:** `liquidglassEdition` aquí es `"standard"`, no `"vpn-local"`, y el guard es `win32`. En Linux el módulo VPN/código es inertes (pero se empaqueta igual).

**`platform.cjs` (6 líneas): idéntico 1.3 = 2.1** — suffix `.exe` solo Windows, rutas `resources/ffmpeg[/ffprobe]`. La versión Linux del repo 1.3 (`/usr/bin/ffmpeg`) se reutiliza tal cual (ver §3).

**`recorder.cjs` (14 líneas): idéntico 1.3 = 2.1** — grabador con autostart solo Windows/macOS; en Linux devuelve *“disponible en Windows y macOS”* pero el grabador sigue activo en sesión. Solo formato (saltos de línea) difiere en el repo 1.3.

### 2.4 `server/` — 8 → 12 archivos
| Archivo | 1.3 | 2.1 | Nota |
|---|---|---|---|
| `app.cjs` | 16K | 19K | + VPN, DownloadQueue, ExclusiveChannels, Loopback |
| `download-queue.cjs` | — | **6.9K nuevo** | jobs + verificación vía `probeDuration` |
| `exclusive-channels.cjs` | — | **2.5K nuevo** | canales extra |
| `loopback.cjs` | — | **638B nuevo** | escucha loopback |
| `regional-vpn.cjs` | — | **3.7K nuevo** | `RegionalVPN`, `parseProfile`, `detectPublicCountry` |
| `media.cjs` | 2.7K | 2.8K | **mejora CPU:** si `videoCodec==='h264'` → `-c:v copy`; si no `libx264 veryfast crf20` |
| `releases.cjs` | 1.6K | 2.1K | manifiesto público |
| `jobs/nook/schedules/series/start.cjs` | — | **idénticos** | sin cambios |

**`media.cjs` es el cambio más importante para N4120:** en 1.3 *todo* se re-codificaba; en 2.1, el caso h264 (99% de streaming) no re-codifica. Downside: si el origen no es h264 sigue usando `veryfast`. Lo dejamos así por equilibrio calidad/CPU (no `ultrafast`).

### 2.5 `public/pc/assets/`
```
1.3: index-C7QdAQYV.css + index-CWQaUgrV.js
2.1: hls-D6a35TnA.js (565K) + index-88I0-1tY.js (289K) + index-DcMg7C6k.css (44K)
```
Frontend React + hls.js. Se adoptó tal cual (no se parchearon los bundles minificados: `setInterval 5s` jobs / `1.2s` player se dejan como upstream).

### 2.6 Binarios / runtime
- `ffmpeg.exe` 139M, `ffprobe.exe` 139M, `elevate.exe`, `app.asar`: en Linux usa ffmpeg sistema, no se empaquetan.
- `LIQUIDGLASS IPTV PLAYER.exe` 239M en ambos (Electron 45.2.2, misma versión). La recompilación Linux usa `electron 45.2.2` + `electron-builder 26.18.0` + Node 22.22.1.

---

## 3. Adaptaciones Linux reutilizadas de 1.3

Carpeta previa: `~/Documentos/LiquidGlass-Linux` (`v1.3.0-linux`, commit `92c98ee`). Copiado a `LiquidGlass-Linux-2.1/` (tar sin tocar `release/`, `node_modules/`).

| Pieza reutilizada | Origen 1.3 | Uso en 2.1 |
|---|---|---|
| `desktop/platform.cjs` (versión repo) | `ffmpeg: linux ? '/usr/bin/ffmpeg' : path.join(resources,…)` | Copiado tal cual. Las 6 líneas upstream son idénticas; solo la rama Linux cambia. |
| `desktop/main.cjs` + `--no-sandbox` Linux | `if (linux) app.commandLine.appendSwitch('no-sandbox')` | Aplicado al `main.cjs` 2.1 (con su parche VPN). |
| `build/icon.png` + `liquidglass.jpeg` + `preparar-icono.sh` | ffmpeg `scale 512×512 pad` | Copiado; `icon.png` sigue válido. |
| `package.json` config electron-builder 1.3 | `appId com.liquidglassiptv.desktop`, `productName LIQUIDGLASS IPTV Plus`, `linux.category AudioVideo`, `syncDesktopName`, `icon` | Reutilizado, versión subida a `2.1.0-rc.1`, añadido `desktopName` + `flatpak` (ver §5-6). |
| `build/after-install.sh` | Corrige `.desktop` con ruta con espacio `"/opt/LIQUIDGLASS IPTV PLAYER/"` y `update-desktop-database` | **Corregido** (ver §5) |

**Qué no se reutilizó:** `node_modules/`, `package-lock.json`, `release/` (se regenera). `desktop/recorder.cjs` del repo 1.3 era solo formato, lógica igual.

---

## 4. Optimizaciones N4120 (equilibrio estable)

> **Objetivo (pedido del usuario):** “un equilibrio estable, rápido y bajo consumo” en Celeron N4120 (4×1.10–2.60 GHz, UHD 600).

| # | Cambio | Archivo | Medida | Efecto esperado |
|---|---|---|---|---|
| 4.1 | Recorder tick `1000 ms → 5000 ms` + `unref()` | `desktop/recorder.cjs` | `setInterval(tick,5000)` | −80% despertares idle (schedules vacío = `readdir` cada 1s en 1.3) |
| 4.2 | Flags Linux ligeros | `desktop/main.cjs` | `--disable-dev-shm-usage`, `--disable-features=Translate` (manteniendo `--no-sandbox`) | Menos IPC/GPU en UHD 600 sin perder descodificación HW |
| 4.3 | Media: mantener `h264 copy` 2.1; `veryfast` solo si no h264 | `server/media.cjs` | Sin cambio de código (ya 2.1) | Playback h264 ~0% re-encode CPU; muy superior a 1.3 |
| 4.4 | `probeDuration` timeout `10s → 8s` | `server/app.cjs` | `},8000)` | Menos bloqueo en `ffprobe` si red lenta |
| 4.5 | **No** parchear bundles frontend (`5s` jobs / `1.2s` player) | `public/pc/assets/*.js` | Intencional | Evitar rotura React/hls minificado |

**Por qué no `ultrafast`:** Recorta 30–40% CPU pero sube artefactos en movimiento. En N4120, con `copy` en h264 (caso mayoritario) y `veryfast` solo si no h264, el equilibrio calidad/CPU es mejor.

**Verificación backend (Node puro, sin GUI):**
```bash
PORT=18931 FFMPEG=/usr/bin/ffmpeg node server/start.cjs
# → LIQUIDGLASS IPTV Desktop en http://127.0.0.1:18931  (~72 MB RSS, 0.0% CPU sostenido tras arranque)
```
El idle completo Electron/Chromium solo se mide en sesión gráfica (en este contenedor falla `GPU process launch failed` por `/tmp` sin SHM; con `--disable-gpu` arranca pero no representa UHD 600).

---

## 5. Bug del menú y corrección

### 5.1 El bug
Instalado 2.1 en `/opt/LIQUIDGLASS IPTV Plus/liquidglass-iptv-desktop` (electron-builder 26 `productName LIQUIDGLASS IPTV Plus`), pero el `.desktop` quedó:
```
Exec="/opt/LIQUIDGLASS IPTV PLAYER/liquidglass-iptv-desktop" --no-sandbox %U   ← ruta 1.3, no existe
```
Causa: `build/after-install.sh` de 1.3 hardcodeaba `Exec="/opt/LIQUIDGLASS IPTV PLAYER/liquidglass-iptv-desktop"`. El DEB generado por electron-builder ya trae `Exec="/opt/LIQUIDGLASS IPTV Plus/..."` correcto; el `after-install` lo pisaba mal.

### 5.2 La corrección (aplicada antes de la compilación final)
`build/after-install.sh` ya no hardcodea ruta; conserva la generada y añade `--no-sandbox` antes de `%U`:
```sh
DESKTOP="/usr/share/applications/liquidglass-iptv-desktop.desktop"
if [ -f "$DESKTOP" ]; then
  if ! grep -q -- "--no-sandbox" "$DESKTOP"; then
    sed -i 's| %U$| --no-sandbox %U|' "$DESKTOP"
  fi
fi
update-desktop-database /usr/share/applications || true
```
`postinst` embebido en el DEB verificado:
```bash
dpkg-deb --ctrl-tarfile *.deb | tar -O -x ./postinst
```

Más `"desktopName": "liquidglass-iptv-desktop.desktop"` en `package.json` (quita el warning de electron-builder y sincroniza `StartupWMClass=liquidglass-iptv-desktop`).

### 5.3 Fix inmediato sin recompilar (override usuario, sin sudo)
```bash
mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/liquidglass-iptv-desktop.desktop <<'EOF'
[Desktop Entry]
Name=LIQUIDGLASS IPTV Plus
Exec="/opt/LIQUIDGLASS IPTV Plus/liquidglass-iptv-desktop" --no-sandbox %U
Terminal=false
Type=Application
Icon=liquidglass-iptv-desktop
StartupWMClass=liquidglass-iptv-desktop
Comment=Aplicación de escritorio LIQUIDGLASS IPTV PLAYER.
Categories=AudioVideo;
EOF
update-desktop-database ~/.local/share/applications
```
Fix sistema (con sudo): `sudo sed -i 's|/opt/LIQUIDGLASS IPTV PLAYER/|/opt/LIQUIDGLASS IPTV Plus/|' /usr/share/applications/liquidglass-iptv-desktop.desktop && sudo update-desktop-database /usr/share/applications`

### 5.4 Verificación en paquetes
| Paquete | `.desktop` inspeccionado |
|---|---|
| DEB | `dpkg-deb --fsys-tarfile … \| tar -O -x ./usr/share/applications/…` → `Exec="/opt/LIQUIDGLASS IPTV Plus/…"` ✅ |
| RPM | `rpm2cpio … \| cpio -i` → mismo ✅ |
| Pacman | `bsdtar -tf …` lista `opt/LIQUIDGLASS IPTV Plus/liquidglass-iptv-desktop` ✅ |

---

## 6. Empaquetado y Flatpak

### 6.1 electron-builder (2.1.0-rc.1)
```json
"appId": "com.liquidglassiptv.desktop",
"productName": "LIQUIDGLASS IPTV Plus",
"desktopName": "liquidglass-iptv-desktop.desktop",
"build.linux.target": ["deb","AppImage","rpm","pacman","flatpak"],
"build.flatpak": {
  "runtime": "org.freedesktop.Platform",
  "runtimeVersion": "25.08",
  "sdk": "org.freedesktop.Sdk",
  "base": "org.electronjs.Electron2.BaseApp",
  "baseVersion": "25.08",
  "finishArgs": ["--share=network","--share=ipc","--socket=pulseaudio","--socket=x11","--socket=wayland","--device=dri","--filesystem=home:rw","--filesystem=xdg-videos:rw","--filesystem=xdg-download:rw"]
},
"build.deb.maxStart": "number",
"scripts.build:linux:all": "npx electron-builder --linux deb rpm pacman AppImage flatpak --x64"
```

### 6.2 Flatpak: por qué fallaba y cómo se resolvió
1. Sin `flatpak-builder` en PATH → se descargó `flatpak-builder_1.4.8-1_amd64.deb` (174K) a `/tmp/opencode/` y se extrajo a `/tmp/opencode/fb/usr/bin/` (sin sudo).
2. electron-builder por defecto busca runtime `org.freedesktop.Platform 20.08` (no instalado, instalados: `25.08/26.08`). Error: `No se encontraron referencias remotas para runtime/…/20.08`.
3. Con `runtimeVersion 25.08` (config §6.1) pasa al SDK `org.freedesktop.Sdk 25.08`, también no instalado y sin remoto usuario. Solución: `flatpak remote-add --user flathub` + `flatpak install --user runtime/org.freedesktop.Sdk/x86_64/25.08`.
4. Con SDK 25.08 (usuario) + Platform 25.08 (sistema) + `org.electronjs.Electron2.BaseApp 25.08` (Flathub), `npx electron-builder --linux flatpak --x64` genera `release/liquidglass-iptv-plus_2.1.0-rc.1_x86_64.flatpak` (93M).
5. Instalación de prueba: `flatpak install --user …flatpak` ✅ + `flatpak info com.liquidglassiptv.desktop` → 303.8 MB, runtime 25.08, commit 2026-11-08.

> **Manifiesto Flathub:** `LiquidGlass-2.1-Linux-Final/flathub-flatpak/manifest.yml` (runtime 25.08, `finishArgs` §6.1) + `README-FLATPAK.md` con permisos y envío Flathub notes.

### 6.3 Comandos usados
```bash
cd ~/Documentos/LiquidGlass-Linux-2.1
npm install                              # ~45s, 283 paquetes
npx electron-builder --linux deb rpm pacman AppImage --x64   # 4 formatos con menú corregido
export PATH="/tmp/opencode/fb/usr/bin:$PATH"
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user runtime/org.freedesktop.Sdk/x86_64/25.08
npx electron-builder --linux flatpak --x64                   # 5º formato
cp release/*.{deb,rpm,pacman,AppImage,flatpak} ~/Documentos/LiquidGlass-2.1-Linux-Final/{deb,fedora-rpm,arch-pacman,AppImage,flathub-flatpak}/
```

---

## 7. Artefactos finales

```
~/Documentos/LiquidGlass-2.1-Linux-Final/
├── deb/liquidglass-iptv-plus_2.1.0-rc.1_amd64.deb          (101M, Depends: ffmpeg)
├── fedora-rpm/liquidglass-iptv-plus_2.1.0-rc.1_x86_64.rpm  (90M, 293M instalado)
├── arch-pacman/liquidglass-iptv-plus_2.1.0-rc.1_x64.pacman (93M)
├── AppImage/liquidglass-iptv-plus_2.1.0-rc.1_x86_64.AppImage (124M)
├── flathub-flatpak/liquidglass-iptv-plus_2.1.0-rc.1_x86_64.flatpak (93M, com.liquidglassiptv.desktop)
│   ├── manifest.yml / README-FLATPAK.md
├── docs/CHANGELOG.md, INVENTARIO-CODIGO-2.1.md
└── README.md
```

**Versión DEB registrada:** `2.1.0~rc.1 amd64` (dpkg), `Depends: ffmpeg`.

**Instalación:**
```bash
sudo dpkg -i deb/*.deb
sudo dnf install fedora-rpm/*.rpm
sudo pacman -U arch-pacman/*.pacman
chmod +x AppImage/*.AppImage && ./AppImage/*.AppImage
flatpak install --user flathub-flatpak/*.flatpak && flatpak run com.liquidglassiptv.desktop
```

---

## 8. Qué NO se tocó

- No reescritura del reproductor ni UI React (bundles minificados intactos).
- No cambios en `LICENSE`, `THIRD_PARTY.md`, `LICENSE-LINUX`.
- VPN OpenVPN (`Broker.cs`, `vpn-service.cjs`, `regional-vpn.cjs`) empaquetada pero inactiva en Linux/`standard` (guard `win32`/`vpn-local`).
- Install dir `productName LIQUIDGLASS IPTV Plus` (con espacio) conservada para no romper upgrades; el fix solo garantiza que el `.desktop` la respete.

---

*Fin de Cambios. Carpetas espejo: `docs/CHANGELOG.md` y `docs/INVENTARIO-CODIGO-2.1.md` en compilación y en Final.*
