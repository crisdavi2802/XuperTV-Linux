# Cambios 1.3 → 2.1 (XuperTV+ Linux)

**Origen:** `XUPER-TV-Plus-2.1.0-rc.1-Portable.exe` (NSIS → `app-64.7z` → `resources/app.asar`)  
**Carpeta de compilación:** `~/Documentos/XuperTV-Linux-2.1`  
**Máquina ref.:** Celeron N4120 — equilibrio estable, rápido, bajo consumo  
**Fecha:** 2026-11-08 · **App:** 2.1.0-rc.1 · **Electron:** 45.2.2 · **electron-builder:** 26.18.0 · **ffmpeg sistema:** 8.0.1

---

## 1. Qué hay en esta carpeta

| Archivo | Contenido |
|---|---|
| `README.md` | Índice |
| **`CAMBIOS-1.3-A-2.1.md`** | **Documento completo:** cambios upstream + adaptaciones Linux + optimización N4120 + empaquetado |
| `RESUMEN.md` | Tabla rápida para revisar sin leer todo |

---

## 2. Resumen en 30 segundos

- **Upstream 2.1:** +11 archivos (VPN, DownloadQueue, ExclusiveChannels, Loopback, HLS nuevo bundle). `platform.cjs` / `recorder.cjs` **idénticos** a 1.3. `media.cjs` ya baja CPU (`h264 copy`).
- **Linux reutilizado 1.3:** `platform.cjs` con `/usr/bin/ffmpeg`, `--no-sandbox` en `main.cjs`, `build/icon.png`, `build/preparar-icono.sh`, `electron-builder` 1.3.
- **N4120 (nuestro parche):** recorder 1s→5s, `--disable-dev-shm-usage` + `--disable-features=Translate`, `probeDuration` 10s→8s.
- **Bug menú corregido antes del final:** `after-install.sh` ya no hardcodea `/opt/XUPER TV+/` sino que conserva `/opt/XUPER TV Plus/` de electron-builder y añade `--no-sandbox`; `desktopName` añadido.
- **5 instalables:** DEB 101M, RPM 90M, Pacman 93M, AppImage 124M, Flatpak 93M (runtime 25.08).

Ver `CAMBIOS-1.3-A-2.1.md` para el detalle y `RESUMEN.md` para la tabla de archivos.
