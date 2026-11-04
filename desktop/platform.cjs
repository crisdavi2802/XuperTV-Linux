const path=require('node:path');

function runtimePaths(platform,resources){
 const mac=platform==='darwin';
 const linux=platform==='linux';
 const suffix=platform==='win32'?'.exe':'';

 return {
  mac,
  ffmpeg:linux?'/usr/bin/ffmpeg':path.join(resources,'ffmpeg'+suffix),
  ffprobe:linux?'/usr/bin/ffprobe':path.join(resources,'ffprobe'+suffix),
  fullscreen:mac?'Ctrl+Command+F':'F11'
 };
}

module.exports={runtimePaths};
