(function(){
 'use strict';
 window.LIQUIDGLASSTV_API.devServiceUrl=location.origin+'/api';
 var nativeLoad=HTMLMediaElement.prototype.load,nativePlay=HTMLMediaElement.prototype.play;
 var engines=new WeakMap(),busy=new WeakSet();
 function clear(video){var previous=engines.get(video);if(previous){try{previous.engine.destroy();}catch(e){}engines.delete(video);}}
 function prepare(video){
  if(busy.has(video))return;
  var source=video.querySelector('source'),url=video.getAttribute('src')||(source&&source.getAttribute('src'))||'';
  if(!url){clear(video);return;}
  if(/^blob:/.test(url))return;
  if(source)source.type=(source.type||'').split(';')[0];
  var previous=engines.get(video);if(previous&&previous.url===url)return;
  clear(video);busy.add(video);
  try{
   if(/\.m3u8(?:[?#]|$)/i.test(url)&&window.Hls&&Hls.isSupported()){
    var hls=new Hls({enableWorker:true,maxBufferLength:25,backBufferLength:30});engines.set(video,{url:url,engine:hls});
    hls.loadSource(url);hls.attachMedia(video);hls.on(Hls.Events.MANIFEST_PARSED,function(){nativePlay.call(video).catch(function(){});});
    hls.on(Hls.Events.ERROR,function(_,data){if(data.fatal&&video.onerror)video.onerror();});
   }else if(/\.ts(?:[?#]|$)/i.test(url)&&window.mpegts&&mpegts.isSupported()){
    var ts=mpegts.createPlayer({type:'mpegts',url:url,isLive:false,hasAudio:true},{enableWorker:true,lazyLoadMaxDuration:30,autoCleanupSourceBuffer:true});engines.set(video,{url:url,engine:ts});ts.attachMediaElement(video);ts.load();
    ts.on(mpegts.Events.ERROR,function(){clear(video);if(video.onerror)video.onerror();});
   }
  }finally{busy.delete(video);}
 }
 HTMLMediaElement.prototype.load=function(){if(busy.has(this))return nativeLoad.call(this);prepare(this);if(!engines.has(this))return nativeLoad.call(this);};
 HTMLMediaElement.prototype.play=function(){prepare(this);return nativePlay.call(this);};
 new MutationObserver(function(){document.querySelectorAll('video').forEach(function(video){prepare(video);});}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
 document.addEventListener('DOMContentLoaded',function(){document.title='LIQUIDGLASS IPTV';var title=document.querySelector('.welcome-name');if(title)title.textContent='LIQUIDGLASS IPTV';});
})();
