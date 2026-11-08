# Componentes y procedencia

El código propio y la adaptación del port webOS conservan su licencia MIT, incluida en LICENSE. Los recursos originales del catálogo siguen perteneciendo a sus autores; public/data/portal.js contiene metadatos y referencias a imágenes del portal, no vídeos.

Windows incluye Electron 45.2.1 y sus avisos Chromium/Electron; React, React DOM, Lucide, hls.js y mpegts.js. Las licencias de las dependencias del navegador están en public/licenses.

El ejecutable FFmpeg se distribuye separado del código de la app y se invoca como proceso externo. Windows usa FFmpeg N-125875-g5d4d3bdc61, compilación GPL de yt-dlp.FFmpeg ya instalada en este PC. La licencia completa está en resources/FFmpeg-LICENSE.txt y junto a ffmpeg.exe dentro del portable.

Fuentes y compilación de FFmpeg: https://github.com/yt-dlp/FFmpeg-Builds y https://github.com/FFmpeg/FFmpeg/commit/5d4d3bdc61 . No se ha modificado este binario. El runtime Linux es Node.js 24.22.2 oficial, con su licencia completa en runtime/LICENSE; usa el FFmpeg del sistema.

Los catálogos se consultan con una sesión de dispositivo en tiempo de ejecución. No se incluyen vídeos, cuentas de terceros ni secretos del servidor NOOK TV en el paquete de Linux.
