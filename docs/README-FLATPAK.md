# Flatpak / Flathub — LiquidGlass+ 2.1.0-rc.1

**Carpeta:** `flathub-flatpak/`  
**Formato:** `.flatpak` (electron-builder `flatpak` o flatpak-builder)  
**ID sugerido Flathub:** `com.liquidglassplus.desktop` o `com.liquidglassiptv.desktop` (mismo `appId` que DEB/RPM para conservar datos).

## Requisitos

- `flatpak` + runtime `org.freedesktop.Platform 23.08` (o 24.08) x86_64
- `flatpak-builder` (paquete `flatpak-builder`) para compilar desde `manifest.json`
- ffmpeg sistema dentro del sandbox (o vía portal). En electron-builder flatpak se suele empaquetar ffmpeg del sistema o descargarlo; aquí se reutiliza `platform.cjs` con `/usr/bin/ffmpeg` adaptado a la ruta dentro del flatpak si se empaqueta.

## Manifiesto electron-builder (añadir a package.json)

```json
"linux": {
  "target": ["deb", "AppImage", "flatpak"],
  "icon": "build/icon.png"
},
"flatpak": {
  "finishArgs": [
    "--share=network",
    "--share=ipc",
    "--socket=pulseaudio",
    "--socket=x11",
    "--socket=wayland",
    "--device=dri",
    "--filesystem=home:rw",
    "--filesystem=xdg-videos:rw",
    "--filesystem=xdg-download:rw"
  ]
}
```

> En sandbox NO se necesita `--no-sandbox` del host (Electron usa `--no-sandbox` solo en .deb/AppImage fuera de flatpak). Mantener `main.cjs` con `if (linux) --no-sandbox` es compatible: en flatpak el sandbox ya aísla, pero el flag no rompe.

## Compilación

```bash
cd ~/Documentos/LiquidGlass-Linux-2.1
npm run build:linux  # incluye flatpak si target lo tiene
# o: npx electron-builder --linux flatpak --x64
cp release/*.flatpak ~/Documentos/LiquidGlass-2.1-Linux-Final/flathub-flatpak/
```

## Instalación / ejecución

```bash
flatpak install ./liquidglass-iptv-plus_2.1.0-rc.1.flatpak
flatpak run com.liquidglassplus.desktop
# o vault: flatpak run --no-sandbox ... (solo si el GPU falla en N4120)
```

## Flathub (envío)

1. Crear repo `flathub/com.liquidglassplus.desktop` con `manifest.yml` (freedesktop runtime) o reutilizar salida de electron-builder.
2. Añadir `metadata` con licencia `LICENSE-LINUX`, iconos `build/icon.png`, screenshots.
3. Declarar dependencia ffmpeg: usar `org.freedesktop.Platform.ffmpeg-full` o empaquetar binario compatible.
4. `flatpak-builder --force-clean build-dir manifest.yml` para test local.

> Estado actual: manifiesto listo para generar. La primera compilación 2.1 en curso genera DEB+AppImage; RPM/Pacman/Flatpak se generan con `build:linux:rpm`, `build:linux:pacman` y target `flatpak`.
