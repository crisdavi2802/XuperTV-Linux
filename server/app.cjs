const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const magis=require('../vendor/magis.cjs');
const proxy=require('../vendor/proxy.cjs');
const {MediaRelay}=require('./media.cjs');
const {nookAdapter}=require('./nook.cjs');
const {JobManager}=require('./jobs.cjs');
const {spawn}=require('node:child_process');
const releases=require('./releases.cjs');
const {ScheduleStore}=require('./schedules.cjs');
async function probeDuration(stream,ffmpeg){if(stream.duration>0)return;const executable=ffmpeg?.replace(/ffmpeg(\.exe)?$/i,'ffprobe$1')||'ffprobe';await new Promise(resolve=>{let data='';const args=['-v','error','-rw_timeout','8000000','-probesize','2M','-analyzeduration','2M'];if(Object.keys(stream.headers||{}).length)args.push('-headers',Object.entries(stream.headers).map(([k,v])=>k+': '+String(v).replace(/[\r\n]/g,'')+'\r\n').join(''));args.push('-show_entries','format=duration','-of','json',stream.url);const p=spawn(executable,args,{windowsHide:true});const timeout=setTimeout(()=>{p.kill();resolve();},10000);p.stdout.on('data',c=>data+=c);p.on('error',()=>{clearTimeout(timeout);resolve();});p.on('close',()=>{clearTimeout(timeout);try{stream.duration=Number(JSON.parse(data).format.duration)||0;}catch{}resolve();});});}
const call=(method,...args)=>new Promise((resolve,reject)=>magis[method](...args,(error,data,more)=>error?reject(error):resolve({data,more})));
const proxyStart=()=>new Promise((resolve,reject)=>proxy.start(error=>error?reject(error):resolve()));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.mp3':'audio/mpeg'};
async function createApp(options={}){
 const root=path.resolve(__dirname,'../public'),token=randomBytes(32).toString('hex'),nook=nookAdapter(options.nook);
 let address='';const relay=new MediaRelay({ffmpeg:options.ffmpeg||process.env.FFMPEG||'ffmpeg',base:()=>address});
 const jobs=options.jobsDirectory?new JobManager({directory:options.jobsDirectory,stateFile:path.join(options.stateDirectory||options.jobsDirectory,'jobs.json'),ffmpeg:options.ffmpeg||'ffmpeg'}):null;
 const schedules=options.stateDirectory?new ScheduleStore(path.join(options.stateDirectory,'schedules')):null;
 const recorderJobs=()=>{if(!options.stateDirectory)return[];return fs.readdirSync(options.stateDirectory).filter(n=>/^recorder-jobs-[a-f0-9]+\.json$/.test(n)).flatMap(n=>{try{return JSON.parse(fs.readFileSync(path.join(options.stateDirectory,n),'utf8')).filter(j=>j.status!=='completed'||fs.existsSync(j.file)).map(j=>({...j,background:true}));}catch{return[];}});};
 const findJob=id=>jobs?.jobs.find(j=>j.id===id)||recorderJobs().find(j=>j.id===id);
 const sources=new Map();
 function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});res.end(body);}
 async function subtitleURLs(stream){if(stream.subtitles?.length){await proxyStart();stream.subtitles=stream.subtitles.map(s=>({...s,url:proxy.addSubtitle(s.url)}));}return stream;}
 async function resolveLive(params){
  let stream;
  if(params.get('streamUrl')){const url=new URL(params.get('streamUrl'));if(!['http:','https:'].includes(url.protocol))throw Error('Fuente no compatible');stream={url:url.href,headers:{},isHls:/\.m3u8/i.test(url.pathname)};}
  else stream=(await call('resolveLive',params.get('channelCode'))).data;
  await proxyStart();stream.proxyPath=proxy.baseUrl()+'/media/'+proxy.add(stream.url,stream.headers,0)+'/stream.'+(stream.isHls===false?'ts':'m3u8');stream.isHls=stream.isHls!==false;return stream;
 }
 async function resolveVod(params,smooth){
  const stream=(await call('resolve',params.get('contentId')||params.get('id'),params.get('seriesContentId')||'',{trackIndex:Number(params.get('trackIndex'))||0})).data;
  if(smooth)await probeDuration(stream,options.ffmpeg);
  if(smooth){stream.proxyPath=relay.register(stream);stream.isRelay=true;stream.isHls=false;stream.mime='video/mp4';}
  else{await proxyStart();stream.proxyPath=proxy.baseUrl()+'/media/'+proxy.add(stream.url,stream.headers,stream.duration)+'/stream.'+(stream.mime==='video/mp4'?'mp4':'ts');stream.isHls=false;}
  return subtitleURLs(stream);
 }
 async function body(req){let value='';for await(const chunk of req){value+=chunk;if(value.length>32768)throw Error('Solicitud demasiado grande');}return JSON.parse(value||'{}');}
 function safeStream(stream){const {headers,url,...output}=stream;return output;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  let u;try{u=new URL(req.url,address||'http://127.0.0.1');}catch{return json(res,400,{error:'Dirección no válida'});}
  const origin=req.headers.origin;
  if((req.headers.host!==new URL(address).host)||(origin&&origin!==address))return json(res,403,{error:'Origen no permitido'});
  try{
   if(u.pathname.startsWith('/s/'))return relay.handle(req,res,u);
   if(u.pathname==='/media/abort'){relay.stop();proxy.killActiveStreams();return json(res,200,{returnValue:true});}
   if(u.pathname==='/api/session')return json(res,200,{token,nook:!!nook});
   if(u.pathname==='/api/updates'&&req.method==='GET')return json(res,200,{update:releases.updatePolicy(await releases.fetchManifest(),'1.3.0'),current:'1.3.0'});
   if(u.pathname==='/api/updates/open'){
    if(req.method!=='POST'||req.headers['x-xuper-token']!==token)return json(res,403,{error:'Solicitud no autorizada'});
    const update=releases.updatePolicy(await releases.fetchManifest(),'1.3.0');if(!update)throw Error('Ya tienes la última versión');await options.openDownload?.(update.url);return json(res,200,{ok:true});
   }
   if(u.pathname==='/api/jobs'&&req.method==='GET')return json(res,200,{jobs:[...(jobs?.list()||[]),...recorderJobs()],directory:jobs?.directory||'',schedules:schedules?.list()||[]});
   if(u.pathname==='/api/schedules/add'||u.pathname==='/api/schedules/cancel'||u.pathname==='/api/fullscreen'||u.pathname==='/api/external'){
    if(req.method!=='POST'||req.headers['x-xuper-token']!==token)return json(res,403,{error:'Solicitud no autorizada'});const data=await body(req);
    if(u.pathname==='/api/fullscreen'){await options.fullscreen?.(data.enabled===true);return json(res,200,{ok:true});}
    if(u.pathname==='/api/external'){const url=new URL(data.url);if(url.protocol!=='https:'||!['www.youtube.com','www.themoviedb.org'].includes(url.hostname))throw Error('Enlace no permitido');await options.openExternal?.(url.href);return json(res,200,{ok:true});}
    if(!schedules)throw Error('Programaciones disponibles en la app de escritorio');
    if(u.pathname.endsWith('/cancel')){schedules.cancel(data.id);return json(res,200,{ok:true});}
    const schedule=schedules.add({...data,directory:jobs.directory});try{const background=await options.enableRecorder?.();return json(res,200,{schedule,background});}catch(error){schedules.cancel(schedule.id);throw error;}
   }
   if(u.pathname.startsWith('/api/jobs/')){
    if(!jobs)return json(res,404,{error:'Descargas disponibles en la aplicación de escritorio.'});
    if(req.method!=='POST'||req.headers['x-xuper-token']!==token)return json(res,403,{error:'Solicitud no autorizada'});
    const data=await body(req);
    if(u.pathname==='/api/jobs/start'){
     if(!['record','download'].includes(data.type))throw Error('Tipo de tarea no válido');
     let stream;
     if(data.type==='record')stream=(await call('resolveLive',String(data.id||''))).data;
     else stream=(await call('resolve',String(data.id||''),String(data.series||''),{})).data;
     return json(res,200,{job:jobs.start({type:data.type,title:data.title||'XUPER TV',stream,limit:data.limit})});
    }
    if(u.pathname==='/api/jobs/play'){const job=findJob(data.id);if(!job||job.status!=='completed'||!fs.existsSync(job.file))throw Error('El archivo ya no está en este PC. Actualiza Descargas.');const stream={url:job.file,headers:{},duration:0};await probeDuration(stream,options.ffmpeg);return json(res,200,{proxyPath:relay.register(stream),duration:stream.duration,isHls:false,offline:true});}
    if(u.pathname==='/api/jobs/stop'){const background=recorderJobs().find(j=>j.id===data.id);if(background){const schedule=schedules?.list().find(s=>s.jobId===background.id);if(schedule)schedules.cancel(schedule.id);}else jobs.stop(data.id);return json(res,200,{ok:true});}
    if(u.pathname==='/api/jobs/folder'){if(options.selectDirectory){const directory=await options.selectDirectory();if(directory){jobs.directory=path.resolve(directory);fs.mkdirSync(jobs.directory,{recursive:true});}}return json(res,200,{directory:jobs.directory});}
    if(u.pathname==='/api/jobs/reveal'){const file=findJob(data.id)?.file||jobs.directory;await options.revealFile?.(file);return json(res,200,{ok:true});}
    if(u.pathname==='/api/jobs/open'){const file=findJob(data.id)?.file;if(!file||!fs.existsSync(file))throw Error('Archivo no encontrado');await options.openFile?.(file);return json(res,200,{ok:true});}
    return json(res,404,{});
   }
   if(u.pathname==='/api/ping')return json(res,200,{returnValue:true,platform:nook?'nook':'desktop',version:'1.3.0'});
   if(u.pathname.startsWith('/api/nook/')){
    if(!nook)return json(res,404,{error:'Esta instalación no está conectada a NOOK TV.'});
    const p=u.searchParams;
    if(req.method==='GET'){
     if(u.pathname==='/api/nook/status'){const state=await nook.request('/api/state'),r=state.runtime||{};return json(res,200,{runtime:{phase:r.phase,current:r.current,title:r.current_title||r.media_title||r.current,error:r.error},playback:state.playback||r.playback||{},playlists:(state.playlists||[]).map(({id,name,items})=>({id,name,count:items?.length||0})),schedules:state.schedules?.length||0});}
     if(u.pathname==='/api/nook/catalog')return json(res,200,await nook.request('/api/catalog?'+new URLSearchParams({q:p.get('q')||'',kind:p.get('kind')||'',group:p.get('group')||'',page:p.get('page')||'0'})));
     if(u.pathname==='/api/nook/groups')return json(res,200,await nook.request('/api/groups?'+new URLSearchParams({kind:p.get('kind')||''})));
    }
    if(req.method!=='POST'||req.headers['x-xuper-token']!==token)return json(res,403,{error:'Solicitud no autorizada'});
    const data=await body(req);
    if(u.pathname==='/api/nook/play'){
     if(data.source==='nook')return json(res,200,await nook.request('/api/play-now',{item_id:String(data.id||'')}));
     const params=new URLSearchParams(data.params||{});let stream;
     if(data.source==='xuper-live')stream=await resolveLive(new URLSearchParams({channelCode:String(data.id||'')}));
     else if(data.source==='xuper-vod'){params.set('contentId',String(data.id||''));stream=await resolveVod(params,false);}
     else throw Error('Fuente no admitida');
     const result=await nook.request('/api/play-now',{url:stream.proxyPath,title:String(data.title||'XUPER TV').slice(0,160),kind:data.source==='xuper-live'?'channels':'movies',position:0});
     return json(res,200,result);
    }
    if(u.pathname==='/api/nook/resume')return json(res,200,await nook.request('/api/resume-schedule',{}));
    if(u.pathname==='/api/nook/control'){
     const allowed=['pause','play','stop','show','volume','seek','audio','subtitle'];
     if(!allowed.includes(data.action))throw Error('Control no admitido');
     return json(res,200,await nook.request('/api/player',data));
    }
    if(u.pathname==='/api/nook/queue'){
     if(data.source!=='nook'||!/^[a-zA-Z0-9_-]{1,80}$/.test(data.playlist||''))throw Error('Selecciona una lista de NOOK TV');
     return json(res,200,await nook.request('/api/playlists/'+data.playlist+'/items',{item_id:String(data.id||'')}));
    }
    return json(res,404,{error:'Operación no disponible'});
   }
   if(u.pathname==='/provider/channels.m3u'){
    const categories=(await call('getLiveCategories')).data;let channels=[];
    if(categories?.length)channels=(await call('getLiveChannels',categories[0].id||categories[0].columnId,1,50)).data;
    let list='#EXTM3U\n';for(const ch of channels){const id=ch.channelCode||ch.id;sources.set(id,ch);list+=`#EXTINF:-1 group-title="XUPER TV",${String(ch.name||ch.title).replace(/[\r\n]/g,' ')}\n${address}/provider/live/${encodeURIComponent(id)}.m3u8\n`;}
    res.writeHead(200,{'Content-Type':'application/x-mpegurl'});return res.end(list);
   }
   if(u.pathname.startsWith('/provider/live/')){
    const id=decodeURIComponent(u.pathname.slice('/provider/live/'.length).replace(/\.m3u8$/,''));const stream=await resolveLive(new URLSearchParams({channelCode:id}));res.writeHead(302,{Location:stream.proxyPath});return res.end();
   }
   if(u.pathname.startsWith('/api/')){
    const method=u.pathname.slice(5),p=u.searchParams;let output={};
    if(method==='home')output=(await call('home',p.get('root')||'featured')).data;
    else if(method==='search')output=(await call('search',p.get('value')||'')).data;
    else if(method==='detail')output=(await call('detail',p.get('contentId')||p.get('id'))).data;
    else if(method==='resolve'||method==='resolveSmooth')output=safeStream(await resolveVod(p,method==='resolveSmooth'||p.get('forceRelay')==='true'||['smooth','relay'].includes(p.get('playbackMode'))));
    else if(method==='resolveLive')output=safeStream(await resolveLive(p));
    else if(method==='mediaInfo')output=await subtitleURLs((await call('mediaInfo',p.get('contentId'),p.get('seriesContentId')||'')).data);
    else if(method==='liveCategories')output={categories:(await call('getLiveCategories')).data};
    else if(method==='liveChannels'){const result=await call('getLiveChannels',p.get('columnId'),Number(p.get('pageNum'))||1,Number(p.get('pageSize'))||50);output={channels:result.data.map(({liveAddressList,...channel})=>channel),hasMore:!!result.more};}
    else if(method==='fetchM3u')output={channels:(await call('fetchM3u',p.get('url'))).data};
    else if(method==='abortMedia'){relay.stop();proxy.killActiveStreams();}
    else if(method==='prewarm')await call('ensureSession');
    else if(!['heartbeat','keepAlive'].includes(method))return json(res,404,{returnValue:false,errorText:'Método no disponible'});
    return json(res,200,{...output,returnValue:true});
   }
   let pathname;try{pathname=decodeURIComponent(u.pathname);}catch{return json(res,404,{});}
   const target=path.resolve(root,'.'+(pathname==='/'?(nook?'/nook/index.html':options.desktopUI?'/pc/index.html':'/index.html'):pathname));
   if(!target.startsWith(root+path.sep))return json(res,404,{});
   if(!fs.existsSync(target)||!fs.statSync(target).isFile())return json(res,404,{});
   res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':path.extname(target)==='.html'?'no-cache':'private,max-age=3600'});
   if(req.method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);
  }catch(error){json(res,502,{returnValue:false,errorText:error.message,error:error.message});}
 });
 await new Promise((resolve,reject)=>{const failed=error=>{if(error.code==='EADDRINUSE'&&options.fallbackPort){server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}else reject(error);};server.once('error',failed);server.listen(options.port??0,'127.0.0.1',()=>{server.removeListener('error',failed);resolve();});});
 address='http://127.0.0.1:'+server.address().port;
 return {url:address,server,token,jobs,close:()=>new Promise(resolve=>{jobs?.close();relay.close();server.close(resolve);server.closeAllConnections();})};
}
module.exports={createApp};
